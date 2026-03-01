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
