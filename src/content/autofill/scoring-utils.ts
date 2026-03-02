import { FIELD_TYPES, FieldType } from "~src/content/autofill/types"

export interface RankedFieldTypes {
  topType: FieldType
  topScore: number
  secondType: FieldType
  secondScore: number
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const createBaseTypeScores = (): Record<FieldType, number> => {
  const scores = {} as Record<FieldType, number>

  for (const fieldType of FIELD_TYPES) {
    scores[fieldType] = 0
  }

  return scores
}

export const getTopTwoScoredTypes = (
  typeScores: Record<FieldType, number>
): RankedFieldTypes => {
  let topType: FieldType = FieldType.Unknown
  let topScore = 0
  let secondType: FieldType = FieldType.Unknown
  let secondScore = 0

  for (const fieldType of FIELD_TYPES) {
    if (fieldType === FieldType.Unknown) {
      continue
    }

    const score = typeScores[fieldType] ?? 0

    if (score > topScore) {
      secondType = topType
      secondScore = topScore
      topType = fieldType
      topScore = score
    } else if (score > secondScore) {
      secondType = fieldType
      secondScore = score
    }
  }

  return { topType, topScore, secondType, secondScore }
}
