import { collectLabelLikeCandidates } from "~src/content/autofill/layer2/layer2-candidates"
import { evaluateFieldWithLayer2 } from "~src/content/autofill/layer2/layer2-scoring"
import {
  Layer1Result,
  LayerStatus,
  ResolutionLayer
} from "~src/content/autofill/types"

interface Layer2RefinementOptions {
  debug?: boolean
}

const LAYER1_RESOLUTION: ResolutionLayer = "layer1"
const LAYER2_RESOLUTION: ResolutionLayer = "layer2"

const hasLayer2TargetStatus = (result: Layer1Result): boolean =>
  result.status === LayerStatus.Ambiguous || result.status === LayerStatus.Unresolved

const applyLayer2Decision = (result: Layer1Result): Layer1Result => ({
  ...result,
  resolutionLayer: result.resolutionLayer ?? LAYER1_RESOLUTION
})

export const refineResultsWithLayer2 = (
  results: Layer1Result[],
  options: Layer2RefinementOptions = {}
): Layer1Result[] => {
  const candidates = collectLabelLikeCandidates(document)

  const refined = results.map((result) => {
    const baseResult = applyLayer2Decision(result)

    if (!hasLayer2TargetStatus(baseResult)) {
      return baseResult
    }

    const decision = evaluateFieldWithLayer2(baseResult, candidates)

    if (!decision) {
      return baseResult
    }

    if (decision.status !== LayerStatus.Resolved) {
      return {
        ...baseResult,
        layer2Match: decision.match ?? baseResult.layer2Match
      }
    }

    return {
      ...baseResult,
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
