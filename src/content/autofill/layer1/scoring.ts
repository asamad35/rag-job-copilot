import {
  Evidence,
  ExtractedSignals,
  FieldType,
  LayerStatus,
  ScoredLayer1Field,
  SignalType
} from "~src/content/autofill/types"
import {
  getMatchesFromAutocomplete,
  getMatchesFromText,
  isGenericText
} from "~src/content/autofill/layer1/vocabulary"
import {
  clamp,
  createBaseTypeScores,
  getTopTwoScoredTypes
} from "~src/content/autofill/scoring-utils"

const ACCEPT_THRESHOLD = 0.9
const REVIEW_THRESHOLD = 0.5
const MARGIN_DIVISOR = 0.35
const CONFLICT_PENALTY = 0.25
const GENERIC_TEXT_PENALTY = 0.1
const STRONG_EVIDENCE_WEIGHT = 0.75

const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  [SignalType.LabelFor]: 1,
  [SignalType.LabelWrap]: 0.95,
  [SignalType.AriaLabelledBy]: 0.9,
  [SignalType.Autocomplete]: 0.85,
  [SignalType.AriaLabel]: 0.8,
  [SignalType.Name]: 0.65,
  [SignalType.Id]: 0.65,
  [SignalType.Placeholder]: 0.45
}

const HIGH_PRIORITY_SIGNALS = new Set<SignalType>([
  SignalType.LabelFor,
  SignalType.LabelWrap,
  SignalType.AriaLabelledBy,
  SignalType.Autocomplete
])

const STRONG_FIRST_NAME_PATTERNS = [
  /(^|[^a-z0-9])(first|given)[ _-]?name([^a-z0-9]|$)/i,
  /(^|[^a-z0-9])fname([^a-z0-9]|$)/i
]

const STRONG_LAST_NAME_PATTERNS = [
  /(^|[^a-z0-9])(last|family|sur)[ _-]?name([^a-z0-9]|$)/i,
  /(^|[^a-z0-9])lname([^a-z0-9]|$)/i
]

const FIRST_NAME_PLACEHOLDER_HINTS = new Set(["first", "first name", "given name"])
const LAST_NAME_PLACEHOLDER_HINTS = new Set(["last", "last name", "family name"])
const FULL_NAME_LABEL_HINTS = new Set([
  "name",
  "your name",
  "full name",
  "candidate name"
])

const normalizeHintText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")

const hasPatternSignalMatch = (
  values: string[],
  patterns: readonly RegExp[]
): boolean =>
  values.some((value) => patterns.some((pattern) => pattern.test(value)))

const hasStrongFirstNameSignal = (signals: ExtractedSignals): boolean => {
  const idLikeValues = [
    ...(signals[SignalType.Name] ?? []),
    ...(signals[SignalType.Id] ?? []),
    ...(signals[SignalType.Autocomplete] ?? [])
  ]

  if (hasPatternSignalMatch(idLikeValues, STRONG_FIRST_NAME_PATTERNS)) {
    return true
  }

  const normalizedPlaceholders = (signals[SignalType.Placeholder] ?? []).map(
    normalizeHintText
  )

  const hasFirstPlaceholder = normalizedPlaceholders.some((placeholder) =>
    FIRST_NAME_PLACEHOLDER_HINTS.has(placeholder)
  )

  return hasFirstPlaceholder && hasPatternSignalMatch(idLikeValues, [/first|given/i])
}

const hasStrongLastNameSignal = (signals: ExtractedSignals): boolean => {
  const idLikeValues = [
    ...(signals[SignalType.Name] ?? []),
    ...(signals[SignalType.Id] ?? []),
    ...(signals[SignalType.Autocomplete] ?? [])
  ]

  if (hasPatternSignalMatch(idLikeValues, STRONG_LAST_NAME_PATTERNS)) {
    return true
  }

  const normalizedPlaceholders = (signals[SignalType.Placeholder] ?? []).map(
    normalizeHintText
  )

  const hasLastPlaceholder = normalizedPlaceholders.some((placeholder) =>
    LAST_NAME_PLACEHOLDER_HINTS.has(placeholder)
  )

  return hasLastPlaceholder && hasPatternSignalMatch(idLikeValues, [/last|family|sur/i])
}

const hasStrongFullNameSignal = (signals: ExtractedSignals): boolean => {
  const labelValues = [
    ...(signals[SignalType.LabelFor] ?? []),
    ...(signals[SignalType.LabelWrap] ?? []),
    ...(signals[SignalType.AriaLabelledBy] ?? []),
    ...(signals[SignalType.AriaLabel] ?? [])
  ].map(normalizeHintText)

  if (labelValues.length === 0) {
    return false
  }

  const hasStrongNameLabel = labelValues.some((value) =>
    FULL_NAME_LABEL_HINTS.has(value)
  )

  if (!hasStrongNameLabel) {
    return false
  }

  // Avoid forcing full-name when split first/last signals exist.
  if (hasStrongFirstNameSignal(signals) || hasStrongLastNameSignal(signals)) {
    return false
  }

  return true
}

const hasStrongCountrySignal = (signals: ExtractedSignals): boolean => {
  const hintValues = [
    ...(signals[SignalType.AriaLabel] ?? []),
    ...(signals[SignalType.AriaLabelledBy] ?? []),
    ...(signals[SignalType.Name] ?? []),
    ...(signals[SignalType.Id] ?? [])
  ].map(normalizeHintText)

  return hintValues.some(
    (value) => value.includes("country selector") || value === "country"
  )
}

const hasStrongConflict = (evidence: Evidence[]): boolean => {
  const dominantTypeBySignal = new Map<SignalType, Evidence>()

  for (const item of evidence) {
    if (!HIGH_PRIORITY_SIGNALS.has(item.signal)) {
      continue
    }

    if (item.weight < STRONG_EVIDENCE_WEIGHT) {
      continue
    }

    const existing = dominantTypeBySignal.get(item.signal)

    if (!existing || item.weight > existing.weight) {
      dominantTypeBySignal.set(item.signal, item)
    }
  }

  if (dominantTypeBySignal.size < 2) {
    return false
  }

  const topSignalTypes = new Set(
    Array.from(dominantTypeBySignal.values(), (item) => item.matchedType)
  )

  return topSignalTypes.size > 1
}

const hasGenericOnlySignals = (signals: ExtractedSignals): boolean => {
  const rawValues = Object.values(signals).flatMap((values) => values)

  if (rawValues.length === 0) {
    return false
  }

  return rawValues.every((value) => isGenericText(value))
}

const getStatusForConfidence = (
  confidence: number,
  hasMatch: boolean
): LayerStatus => {
  if (!hasMatch) {
    return LayerStatus.Unresolved
  }

  if (confidence >= ACCEPT_THRESHOLD) {
    return LayerStatus.Resolved
  }

  if (confidence >= REVIEW_THRESHOLD) {
    return LayerStatus.Ambiguous
  }

  return LayerStatus.Unresolved
}

export const scoreLayer1Signals = (
  signals: ExtractedSignals
): ScoredLayer1Field => {
  const typeScores = createBaseTypeScores()
  const evidence: Evidence[] = []

  for (const signalType of Object.values(SignalType)) {
    const signalValues = signals[signalType]
    if (!signalValues || signalValues.length === 0) {
      continue
    }

    const signalWeight = SIGNAL_WEIGHTS[signalType]

    for (const rawValue of signalValues) {
      if (!rawValue.trim()) {
        continue
      }

      if (signalType === SignalType.Autocomplete) {
        const matches = getMatchesFromAutocomplete(rawValue)
        for (const matchedType of matches) {
          typeScores[matchedType] += signalWeight
          evidence.push({
            signal: signalType,
            rawValue,
            matchedType,
            weight: signalWeight
          })
        }
        continue
      }

      const matches = getMatchesFromText(rawValue)
      for (const match of matches) {
        const weightedScore = signalWeight * match.score
        typeScores[match.fieldType] += weightedScore
        evidence.push({
          signal: signalType,
          rawValue,
          matchedType: match.fieldType,
          weight: weightedScore
        })
      }
    }
  }

  const hasCountrySelectorSignal = hasStrongCountrySignal(signals)
  if (hasCountrySelectorSignal) {
    typeScores[FieldType.Country] = Math.max(typeScores[FieldType.Country], 1.2)
    typeScores[FieldType.Phone] = Number(
      (typeScores[FieldType.Phone] * 0.35).toFixed(4)
    )
  }

  const { topType, topScore, secondScore } = getTopTwoScoredTypes(typeScores)

  const conflictPenalty = hasStrongConflict(evidence) ? CONFLICT_PENALTY : 0
  const genericPenalty = hasGenericOnlySignals(signals)
    ? GENERIC_TEXT_PENALTY
    : 0

  let adjustedTopScore = Math.max(
    0,
    topScore - conflictPenalty - genericPenalty
  )

  if (
    topType === FieldType.FirstName &&
    hasStrongFirstNameSignal(signals)
  ) {
    adjustedTopScore = Math.max(adjustedTopScore, 0.95)
  }

  if (
    topType === FieldType.LastName &&
    hasStrongLastNameSignal(signals)
  ) {
    adjustedTopScore = Math.max(adjustedTopScore, 0.95)
  }

  if (
    topType === FieldType.FullName &&
    hasStrongFullNameSignal(signals)
  ) {
    adjustedTopScore = Math.max(adjustedTopScore, 0.92)
  }

  if (
    topType === FieldType.Country &&
    hasStrongCountrySignal(signals)
  ) {
    adjustedTopScore = Math.max(adjustedTopScore, 0.95)
  }

  const absScore = clamp(adjustedTopScore, 0, 1)
  const marginScore = clamp(
    (adjustedTopScore - secondScore) / MARGIN_DIVISOR,
    0,
    1
  )
  const confidence = Number((0.7 * absScore + 0.3 * marginScore).toFixed(4))
  const hasMatch = adjustedTopScore > 0

  return {
    fieldType: hasMatch ? topType : FieldType.Unknown,
    confidence,
    status: getStatusForConfidence(confidence, hasMatch),
    evidence,
    typeScores
  }
}
