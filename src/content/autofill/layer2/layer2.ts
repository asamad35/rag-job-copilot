import { collectLabelLikeCandidates } from "~src/content/autofill/layer2/layer2-candidates"
import { evaluateFieldWithLayer2 } from "~src/content/autofill/layer2/layer2-scoring"
import {
  ControlKind,
  FieldType,
  Layer1Result,
  LayerStatus,
  ResolutionLayer
} from "~src/content/autofill/types"

interface Layer2RefinementOptions {
  debug?: boolean
}

const LAYER2_RESOLUTION: ResolutionLayer = "layer2"

const hasLayer2TargetStatus = (result: Layer1Result): boolean =>
  result.status === LayerStatus.Ambiguous ||
  result.status === LayerStatus.Unresolved

const shouldAcceptLayer2Resolution = (
  result: Layer1Result,
  fieldType: FieldType
): boolean => {
  if (result.controlKind !== ControlKind.File) {
    return true
  }

  return fieldType === FieldType.Resume
}

export const refineResultsWithLayer2 = (
  results: Layer1Result[],
  options: Layer2RefinementOptions = {}
): Layer1Result[] => {
  const candidates = collectLabelLikeCandidates(document)

  const refined = results.map((result) => {
    if (!hasLayer2TargetStatus(result)) {
      return result
    }

    const decision = evaluateFieldWithLayer2(result, candidates)

    if (!decision) {
      return result
    }

    if (decision.status !== LayerStatus.Resolved) {
      return {
        ...result,
        layer2Match: decision.match ?? result.layer2Match
      }
    }

    if (!shouldAcceptLayer2Resolution(result, decision.fieldType)) {
      return {
        ...result,
        layer2Match: decision.match ?? result.layer2Match
      }
    }

    return {
      ...result,
      fieldType: decision.fieldType,
      confidence: decision.confidence,
      status: decision.status,
      typeScores: decision.typeScores,
      layer2Match: decision.match,
      resolutionLayer: LAYER2_RESOLUTION
    }
  })

  if (options.debug) {
    const promoted = refined.filter(
      (result) => result.resolutionLayer === LAYER2_RESOLUTION
    )

    console.group("[Layer2 Refinement]")
    console.info("Candidate text nodes:", candidates.length)
    console.info("Promoted fields:", promoted.length)

    for (const field of promoted) {
      console.info(field.fieldId, {
        fieldType: field.fieldType,
        confidence: field.confidence,
        match: field.layer2Match
      })
    }

    console.groupEnd()
  }

  return refined
}
