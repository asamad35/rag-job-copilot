import { DISCOVERABLE_FIELD_SELECTOR } from "~src/content/autofill/dom-utils"
import { getMatchesFromText } from "~src/content/autofill/layer1/vocabulary"
import {
  appearsBeforeInDom,
  getAncestorElements,
  getLcaDistance
} from "~src/content/autofill/layer2/layer2-lca"
import {
  clamp,
  createBaseTypeScores,
  getTopTwoScoredTypes
} from "~src/content/autofill/scoring-utils"
import {
  FIELD_TYPES,
  FieldType,
  LabelLikeCandidate,
  Layer1Result,
  Layer2Decision,
  LayerStatus
} from "~src/content/autofill/types"

// Confidence >= accept => promote to resolved.
const LAYER2_ACCEPT_THRESHOLD = 0.8
// Confidence in [review, accept) => keep as ambiguous.
const LAYER2_REVIEW_THRESHOLD = 0.5
// Larger divisor makes top-vs-second margin less aggressive.
const MARGIN_DIVISOR = 0.35
// Small local-bias bonus when a strong lexical signal is nearby.
const STRONG_LOCAL_MATCH_BONUS = 0.08
const CONFIDENCE_ABS_WEIGHT = 0.65
const CONFIDENCE_MARGIN_WEIGHT = 0.35
const MIN_LAYER2_SIGNAL_SCORE = 0.2
const LOW_LEXICAL_STRENGTH = 0.85
const LOW_LEXICAL_MARGIN = 0.12
const LEXICAL_AMBIGUITY_PENALTY = 0.12
const MIN_RESOLVE_LIFT = 0.12
const FAR_OUT_OF_GROUP_DISTANCE = 12
const FAR_OUT_OF_GROUP_CONFIDENCE_CAP = 0.6
const GROUP_CANDIDATE_DENSITY_DIVISOR = 5
const GROUP_SMALL_CONTROL_THRESHOLD = 8
const GROUP_LARGE_CONTROL_THRESHOLD = 24
const GROUP_SMALL_CONTROL_BONUS = 0.5
const GROUP_LARGE_CONTROL_PENALTY = 0.8
const GROUP_SMALL_SUBTREE_THRESHOLD = 2
const GROUP_LARGE_SUBTREE_THRESHOLD = 350
const GROUP_SMALL_SUBTREE_PENALTY = 0.4
const GROUP_LARGE_SUBTREE_PENALTY = 1
const GROUP_SEMANTIC_TAG_BONUS = 0.45
const GROUP_REPEATED_SIBLING_BONUS = 0.6
const GROUP_DEPTH_PENALTY_STEP = 0.08
const REPEATED_SHAPE_CLASS_SIMILARITY = 0.5
const REPEATED_SHAPE_MIN_MATCHES = 1
const OUT_OF_GROUP_DIRECTION_DISTANCE_CUTOFF = 6
const MAX_SAME_GROUP_DISTANCE = 7
const STRUCTURE_CONTAINS_FIELD_PENALTY = 0.08
const STRUCTURE_CONTROL_PENALTY_STEP = 0.04
const STRUCTURE_CONTROL_PENALTY_MAX = 0.18
const STRONG_LOCAL_MAX_DISTANCE = 4
const STRONG_LOCAL_MIN_LEXICAL_SCORE = 0.6
const OUT_OF_GROUP_RESOLVE_CAP = 0.79

const SEMANTIC_GROUP_TAGS = new Set([
  "fieldset",
  "section",
  "article",
  "li",
  "tr"
])

const getControlCount = (element: HTMLElement): number =>
  element.querySelectorAll(DISCOVERABLE_FIELD_SELECTOR).length

const getSubtreeSize = (element: HTMLElement): number =>
  element.querySelectorAll("*").length

const getCandidateCountInGroup = (
  group: HTMLElement,
  candidates: LabelLikeCandidate[]
): number =>
  candidates.filter((candidate) => group.contains(candidate.element)).length

const toClassTokenSet = (element: HTMLElement): Set<string> =>
  new Set(Array.from(element.classList).filter(Boolean))

const getClassSimilarity = (left: Set<string>, right: Set<string>): number => {
  if (left.size === 0 && right.size === 0) {
    return 1
  }

  if (left.size === 0 || right.size === 0) {
    return 0
  }

  let intersection = 0

  for (const token of left) {
    if (right.has(token)) {
      intersection += 1
    }
  }

  const union = left.size + right.size - intersection

  return union > 0 ? intersection / union : 0
}

const hasRepeatedSiblingShape = (element: HTMLElement): boolean => {
  const parent = element.parentElement

  if (!parent) {
    return false
  }

  const baseClassTokens = toClassTokenSet(element)
  const similarSiblings = Array.from(parent.children).filter((child) => {
    if (!(child instanceof HTMLElement)) {
      return false
    }

    if (child === element || child.tagName !== element.tagName) {
      return false
    }

    const siblingClassTokens = toClassTokenSet(child)
    const classSimilarity = getClassSimilarity(baseClassTokens, siblingClassTokens)

    return classSimilarity >= REPEATED_SHAPE_CLASS_SIMILARITY
  })

  return similarSiblings.length >= REPEATED_SHAPE_MIN_MATCHES
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

    if (
      controlCount === 1 &&
      candidateCount > 0 &&
      subtreeSize >= GROUP_SMALL_SUBTREE_THRESHOLD &&
      subtreeSize <= GROUP_LARGE_SUBTREE_THRESHOLD
    ) {
      return ancestor
    }

    let score = 0

    score += 1
    score += clamp(candidateCount / GROUP_CANDIDATE_DENSITY_DIVISOR, 0, 1)

    if (controlCount <= GROUP_SMALL_CONTROL_THRESHOLD) {
      score += GROUP_SMALL_CONTROL_BONUS
    } else if (controlCount > GROUP_LARGE_CONTROL_THRESHOLD) {
      score -= GROUP_LARGE_CONTROL_PENALTY
    }

    if (subtreeSize < GROUP_SMALL_SUBTREE_THRESHOLD) {
      score -= GROUP_SMALL_SUBTREE_PENALTY
    } else if (subtreeSize > GROUP_LARGE_SUBTREE_THRESHOLD) {
      score -= GROUP_LARGE_SUBTREE_PENALTY
    }

    if (SEMANTIC_GROUP_TAGS.has(ancestor.tagName.toLowerCase())) {
      score += GROUP_SEMANTIC_TAG_BONUS
    }

    if (hasRepeatedSiblingShape(ancestor)) {
      score += GROUP_REPEATED_SIBLING_BONUS
    }

    // Prefer tighter/nearer groups over deep ancestors like page-level wrappers.
    score -= depth * GROUP_DEPTH_PENALTY_STEP

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

const getStructurePenalty = (
  candidateElement: HTMLElement,
  fieldElement: HTMLElement
): number => {
  let penalty = 0
  const nestedControlCount = getControlCount(candidateElement)

  if (candidateElement.contains(fieldElement)) {
    penalty += STRUCTURE_CONTAINS_FIELD_PENALTY
  }

  if (nestedControlCount > 1) {
    penalty += Math.min(
      STRUCTURE_CONTROL_PENALTY_MAX,
      (nestedControlCount - 1) * STRUCTURE_CONTROL_PENALTY_STEP
    )
  }

  return penalty
}

const selectCandidatesForGroup = (
  groupRoot: HTMLElement,
  candidates: LabelLikeCandidate[]
): LabelLikeCandidate[] => {
  const inGroup: LabelLikeCandidate[] = []
  const outGroup: LabelLikeCandidate[] = []

  for (const candidate of candidates) {
    if (groupRoot.contains(candidate.element)) {
      inGroup.push(candidate)
    } else {
      outGroup.push(candidate)
    }
  }

  return inGroup.length > 0 ? [...inGroup, ...outGroup] : outGroup
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
  const isBeforeField = appearsBeforeInDom(candidate.element, fieldResult.element)

  if (
    !sameGroup &&
    !isBeforeField &&
    distance > OUT_OF_GROUP_DIRECTION_DISTANCE_CUTOFF
  ) {
    return null
  }

  if (sameGroup && distance > MAX_SAME_GROUP_DISTANCE) {
    return null
  }

  const distanceWeight = getDistanceWeight(distance)
  const groupWeight = sameGroup ? 0.35 : 0
  const directionWeight = isBeforeField ? 0.1 : 0
  const noisePenalty = getNoisePenalty(candidate.textLength)
  const structurePenalty = getStructurePenalty(
    candidate.element,
    fieldResult.element
  )

  const proximityWeight = Math.max(
    0,
    distanceWeight + groupWeight + directionWeight - noisePenalty - structurePenalty
  )

  if (proximityWeight <= 0) {
    return null
  }

  const layer2Scores = createBaseTypeScores()

  for (const lexicalMatch of lexicalMatches) {
    layer2Scores[lexicalMatch.fieldType] += lexicalMatch.score * proximityWeight
  }

  const lexicalTop = getTopTwoScoredTypes(layer2Scores)

  if (lexicalTop.topScore < MIN_LAYER2_SIGNAL_SCORE) {
    return null
  }

  const combinedScores = createBaseTypeScores()

  for (const fieldType of FIELD_TYPES) {
    combinedScores[fieldType] =
      (fieldResult.typeScores[fieldType] ?? 0) + (layer2Scores[fieldType] ?? 0)
  }

  const { topType, topScore, secondScore } =
    getTopTwoScoredTypes(combinedScores)
  const hasMatch = topType !== FieldType.Unknown && topScore > 0

  const absScore = clamp(topScore, 0, 1)
  const marginScore = clamp((topScore - secondScore) / MARGIN_DIVISOR, 0, 1)
  let confidence =
    CONFIDENCE_ABS_WEIGHT * absScore + CONFIDENCE_MARGIN_WEIGHT * marginScore

  if (!sameGroup) {
    confidence = Math.min(confidence, OUT_OF_GROUP_RESOLVE_CAP)
  }

  if (!sameGroup && distance >= FAR_OUT_OF_GROUP_DISTANCE) {
    confidence = Math.min(confidence, FAR_OUT_OF_GROUP_CONFIDENCE_CAP)
  }

  const strongLocalMatch =
    sameGroup &&
    distance <= STRONG_LOCAL_MAX_DISTANCE &&
    lexicalTop.topType !== FieldType.Unknown &&
    lexicalTop.topScore >= STRONG_LOCAL_MIN_LEXICAL_SCORE

  if (strongLocalMatch) {
    confidence = Math.min(1, confidence + STRONG_LOCAL_MATCH_BONUS)
  }

  if (!hasMatch) {
    confidence = 0
  } else {
    const lexicalMargin = lexicalTop.topScore - lexicalTop.secondScore
    if (
      lexicalTop.topScore < LOW_LEXICAL_STRENGTH &&
      lexicalMargin < LOW_LEXICAL_MARGIN
    ) {
      confidence = Math.max(0, confidence - LEXICAL_AMBIGUITY_PENALTY)
    }

    const currentTopScore = fieldResult.typeScores[topType] ?? 0
    const resolveLift = topScore - currentTopScore

    if (
      confidence >= LAYER2_ACCEPT_THRESHOLD &&
      resolveLift < MIN_RESOLVE_LIFT
    ) {
      confidence = Math.min(confidence, LAYER2_ACCEPT_THRESHOLD - 0.01)
    }
  }

  confidence = Number(clamp(confidence, 0, 1).toFixed(4))

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

  if (nextScore !== currentScore) {
    return nextScore > currentScore
  }

  const nextDistance = next.match?.lcaDistance ?? Number.POSITIVE_INFINITY
  const currentDistance = current.match?.lcaDistance ?? Number.POSITIVE_INFINITY

  if (nextDistance !== currentDistance) {
    return nextDistance < currentDistance
  }

  const nextLexicalScore = next.match?.lexicalScore ?? 0
  const currentLexicalScore = current.match?.lexicalScore ?? 0

  if (nextLexicalScore !== currentLexicalScore) {
    return nextLexicalScore > currentLexicalScore
  }

  const nextTextLength = next.match?.candidateText.length ?? Number.POSITIVE_INFINITY
  const currentTextLength =
    current.match?.candidateText.length ?? Number.POSITIVE_INFINITY

  return nextTextLength < currentTextLength
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
  const scopedCandidates = selectCandidatesForGroup(groupRoot, candidates)
  let bestDecision: Layer2Decision | null = null

  for (const candidate of scopedCandidates) {
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
