import {
  Evidence,
  ExtractedSignals,
  FIELD_TYPES,
  FieldType,
  LayerStatus,
  ScoredLayer1Field,
  SignalType
} from "~src/content/autofill/types"
import {
  getMatchesFromAutocomplete,
  getMatchesFromText,
  isGenericText
} from "~src/content/autofill/vocabulary"

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

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const createBaseTypeScores = (): Record<FieldType, number> => {
  const scores = {} as Record<FieldType, number>
  for (const fieldType of FIELD_TYPES) {
    scores[fieldType] = 0
  }
  return scores
}

const getTopTwoScoredTypes = (typeScores: Record<FieldType, number>) => {
  const sorted = [...FIELD_TYPES]
    .filter((fieldType) => fieldType !== FieldType.Unknown)
    .sort((left, right) => typeScores[right] - typeScores[left])

  const topType = sorted[0] ?? FieldType.Unknown
  const secondType = sorted[1] ?? FieldType.Unknown

  return {
    topType,
    topScore: typeScores[topType] ?? 0,
    secondType,
    secondScore: typeScores[secondType] ?? 0
  }
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

  const { topType, topScore, secondScore } = getTopTwoScoredTypes(typeScores)

  const conflictPenalty = hasStrongConflict(evidence) ? CONFLICT_PENALTY : 0
  const genericPenalty = hasGenericOnlySignals(signals)
    ? GENERIC_TEXT_PENALTY
    : 0

  const adjustedTopScore = Math.max(
    0,
    topScore - conflictPenalty - genericPenalty
  )
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
