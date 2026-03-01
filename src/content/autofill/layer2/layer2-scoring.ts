import {
  FIELD_TYPES,
  FieldType,
  LabelLikeCandidate,
  Layer1Result,
  Layer2Decision,
  Layer2Match,
  LayerStatus
} from "~src/content/autofill/types"
import {
  appearsBeforeInDom,
  getAncestorElements,
  getLcaDistance
} from "~src/content/autofill/layer2/layer2-lca"
import { getMatchesFromText } from "~src/content/autofill/layer1/vocabulary"

const LAYER2_ACCEPT_THRESHOLD = 0.8
const LAYER2_REVIEW_THRESHOLD = 0.5
const MARGIN_DIVISOR = 0.35
const STRONG_LOCAL_MATCH_BONUS = 0.08

const CONTROL_SELECTOR = [
  "input:not([type='hidden'])",
  "textarea",
  "select",
  "[role='textbox']",
  "[role='combobox']",
  "[role='listbox']",
  "[role='spinbutton']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='slider']",
  "[contenteditable='true']",
  "[contenteditable='plaintext-only']"
].join(",")

const SEMANTIC_GROUP_TAGS = new Set(["fieldset", "section", "article", "li", "tr"])

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

const getControlCount = (element: HTMLElement): number =>
  element.querySelectorAll(CONTROL_SELECTOR).length

const getSubtreeSize = (element: HTMLElement): number =>
  element.querySelectorAll("*").length

const getCandidateCountInGroup = (
  group: HTMLElement,
  candidates: LabelLikeCandidate[]
): number => candidates.filter((candidate) => group.contains(candidate.element)).length

const hasRepeatedSiblingShape = (element: HTMLElement): boolean => {
  const parent = element.parentElement

  if (!parent) {
    return false
  }

  const similarSiblings = Array.from(parent.children).filter(
    (child) =>
      child instanceof HTMLElement &&
      child.tagName === element.tagName &&
      child.className === element.className
  )

  return similarSiblings.length >= 2
}

const isCandidateGroup = (
  ancestor: HTMLElement,
  candidates: LabelLikeCandidate[]
): boolean => {
  const candidateCount = getCandidateCountInGroup(ancestor, candidates)
  const controlCount = getControlCount(ancestor)

  return candidateCount > 0 && controlCount > 0
}

export const resolveGroupRoot = (
  fieldElement: HTMLElement,
  candidates: LabelLikeCandidate[]
): HTMLElement => {
  const ancestors = getAncestorElements(fieldElement)

  let bestGroup: HTMLElement | null = null
  let bestScore = Number.NEGATIVE_INFINITY

  for (const [depth, ancestor] of ancestors.entries()) {
    if (!isCandidateGroup(ancestor, candidates)) {
      continue
    }

    const candidateCount = getCandidateCountInGroup(ancestor, candidates)
    const controlCount = getControlCount(ancestor)
    const subtreeSize = getSubtreeSize(ancestor)

    let score = 0

    score += 1
    score += clamp(candidateCount / 5, 0, 1)

    if (controlCount <= 8) {
      score += 0.5
    } else if (controlCount > 24) {
      score -= 0.8
    }

    if (subtreeSize < 2) {
      score -= 0.4
    } else if (subtreeSize > 350) {
      score -= 1
    }

    if (SEMANTIC_GROUP_TAGS.has(ancestor.tagName.toLowerCase())) {
      score += 0.45
    }

    if (hasRepeatedSiblingShape(ancestor)) {
      score += 0.6
    }

    score -= depth * 0.08

    if (score > bestScore) {
      bestScore = score
      bestGroup = ancestor
    }
  }

  return bestGroup ?? fieldElement.parentElement ?? fieldElement
}

const getDistanceWeight = (distance: number): number => {
  if (!Number.isFinite(distance)) {
    return 0
  }

  return 1 / (1 + distance)
}

const getNoisePenalty = (textLength: number): number => {
  if (textLength > 140) {
    return 0.2
  }

  if (textLength > 100) {
    return 0.1
  }

  return 0
}

const getStatusForConfidence = (
  confidence: number,
  hasMatch: boolean
): LayerStatus => {
  if (!hasMatch) {
    return LayerStatus.Unresolved
  }

  if (confidence >= LAYER2_ACCEPT_THRESHOLD) {
    return LayerStatus.Resolved
  }

  if (confidence >= LAYER2_REVIEW_THRESHOLD) {
    return LayerStatus.Ambiguous
  }

  return LayerStatus.Unresolved
}

const buildMatch = (
  fieldResult: Layer1Result,
  candidate: LabelLikeCandidate,
  groupRoot: HTMLElement,
  layer2Scores: Record<FieldType, number>,
  combinedScores: Record<FieldType, number>,
  confidence: number
): Layer2Decision => {
  const { topType, topScore } = getTopTwoScoredTypes(combinedScores)
  const lexicalTop = getTopTwoScoredTypes(layer2Scores)
  const distance = getLcaDistance(fieldResult.element, candidate.element)
  const sameGroup = groupRoot.contains(candidate.element)

  const hasMatch = topType !== FieldType.Unknown && topScore > 0

  return {
    fieldId: fieldResult.fieldId,
    fieldType: hasMatch ? topType : FieldType.Unknown,
    confidence,
    status: getStatusForConfidence(confidence, hasMatch),
    typeScores: combinedScores,
    match: {
      fieldId: fieldResult.fieldId,
      candidateText: candidate.text,
      lcaDistance: distance,
      sameGroup,
      lexicalTopType: lexicalTop.topType,
      lexicalScore: lexicalTop.topScore,
      combinedScore: topScore
    }
  }
}

const scoreCandidate = (
  fieldResult: Layer1Result,
  candidate: LabelLikeCandidate,
  groupRoot: HTMLElement
): Layer2Decision | null => {
  const lexicalMatches = getMatchesFromText(candidate.text)

  if (lexicalMatches.length === 0) {
    return null
  }

  const distance = getLcaDistance(fieldResult.element, candidate.element)

  if (!Number.isFinite(distance)) {
    return null
  }

  const sameGroup = groupRoot.contains(candidate.element)

  const distanceWeight = getDistanceWeight(distance)
  const groupWeight = sameGroup ? 0.35 : 0
  const directionWeight = appearsBeforeInDom(candidate.element, fieldResult.element)
    ? 0.1
    : 0
  const noisePenalty = getNoisePenalty(candidate.textLength)

  const proximityWeight = Math.max(
    0,
    distanceWeight + groupWeight + directionWeight - noisePenalty
  )

  if (proximityWeight <= 0) {
    return null
  }

  const layer2Scores = createBaseTypeScores()

  for (const lexicalMatch of lexicalMatches) {
    layer2Scores[lexicalMatch.fieldType] += lexicalMatch.score * proximityWeight
  }

  const combinedScores = createBaseTypeScores()

  for (const fieldType of FIELD_TYPES) {
    combinedScores[fieldType] =
      (fieldResult.typeScores[fieldType] ?? 0) + (layer2Scores[fieldType] ?? 0)
  }

  const { topType, topScore, secondScore } = getTopTwoScoredTypes(combinedScores)
  const lexicalTop = getTopTwoScoredTypes(layer2Scores)
  const hasMatch = topType !== FieldType.Unknown && topScore > 0

  const absScore = clamp(topScore, 0, 1)
  const marginScore = clamp((topScore - secondScore) / MARGIN_DIVISOR, 0, 1)
  let confidence = 0.65 * absScore + 0.35 * marginScore

  if (!sameGroup && distance >= 8) {
    confidence = Math.min(confidence, 0.74)
  }

  if (!sameGroup && distance >= 12) {
    confidence = Math.min(confidence, 0.6)
  }

  const strongLocalMatch =
    sameGroup &&
    distance <= 4 &&
    lexicalTop.topType !== FieldType.Unknown &&
    lexicalTop.topScore >= 0.6

  if (strongLocalMatch) {
    confidence = Math.min(1, confidence + STRONG_LOCAL_MATCH_BONUS)
  }

  confidence = Number(confidence.toFixed(4))

  if (!hasMatch) {
    confidence = 0
  }

  return buildMatch(
    fieldResult,
    candidate,
    groupRoot,
    layer2Scores,
    combinedScores,
    confidence
  )
}

const shouldReplaceDecision = (
  current: Layer2Decision | null,
  next: Layer2Decision
): boolean => {
  if (!current) {
    return true
  }

  if (next.confidence !== current.confidence) {
    return next.confidence > current.confidence
  }

  const nextScore = next.match?.combinedScore ?? 0
  const currentScore = current.match?.combinedScore ?? 0

  return nextScore > currentScore
}

export const evaluateFieldWithLayer2 = (
  fieldResult: Layer1Result,
  candidates: LabelLikeCandidate[]
): Layer2Decision | null => {
  if (fieldResult.status === LayerStatus.Resolved) {
    return null
  }

  if (!(fieldResult.element instanceof HTMLElement)) {
    return null
  }

  const groupRoot = resolveGroupRoot(fieldResult.element, candidates)

  let bestDecision: Layer2Decision | null = null

  for (const candidate of candidates) {
    const decision = scoreCandidate(fieldResult, candidate, groupRoot)

    if (!decision) {
      continue
    }

    if (shouldReplaceDecision(bestDecision, decision)) {
      bestDecision = decision
    }
  }

  return bestDecision
}
