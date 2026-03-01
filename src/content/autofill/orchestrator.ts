import { discoverFormFields } from "~src/content/autofill/layer1/field-discovery"
import { fillResolvedFields } from "~src/content/autofill/layer1/fill"
import { evaluateFieldWithLayer1 } from "~src/content/autofill/layer1/layer1"
import { refineResultsWithLayer2 } from "~src/content/autofill/layer2/layer2"
import {
  AutofillProfile,
  Layer1RunOptions,
  Layer1RunSnapshot,
  Layer1RunSummary,
  LayerStatus
} from "~src/content/autofill/types"
import { getFieldTypeLabel } from "~src/shared/field-labels"

const countByStatus = (
  summary: Layer1RunSummary,
  status: LayerStatus
): number => summary.results.filter((result) => result.status === status).length

export const runAutofillPipeline = (
  profile: AutofillProfile,
  options: Layer1RunOptions = {}
): Promise<Layer1RunSummary> => {
  const discoveredFields = discoverFormFields(document)
  const layer1Results = discoveredFields.map((field) =>
    evaluateFieldWithLayer1(field)
  )
  const results = refineResultsWithLayer2(layer1Results, {
    debug: options.debug
  })
  return fillResolvedFields(results, profile).then((fillActions) => {
    const summary: Layer1RunSummary = {
      totalDiscovered: discoveredFields.length,
      resolved: 0,
      ambiguous: 0,
      unresolved: 0,
      filled: fillActions.filter((action) => action.filled).length,
      skipped: fillActions.filter((action) => !action.filled).length,
      results,
      fillActions
    }

    summary.resolved = countByStatus(summary, LayerStatus.Resolved)
    summary.ambiguous = countByStatus(summary, LayerStatus.Ambiguous)
    summary.unresolved = countByStatus(summary, LayerStatus.Unresolved)

    if (options.debug) {
      console.group("[Autofill Summary]")
      console.info("Total fields:", summary.totalDiscovered)
      console.info("Resolved:", summary.resolved)
      console.info("Ambiguous:", summary.ambiguous)
      console.info("Unresolved:", summary.unresolved)
      console.info("Filled:", summary.filled)
      console.info("Skipped:", summary.skipped)
      console.groupEnd()
    }

    return summary
  })
}

export const runLayer1Autofill = runAutofillPipeline

export const toLayer1RunSnapshot = (
  summary: Layer1RunSummary
): Layer1RunSnapshot => {
  return {
    totalDiscovered: summary.totalDiscovered,
    resolved: summary.resolved,
    ambiguous: summary.ambiguous,
    unresolved: summary.unresolved,
    filled: summary.filled,
    skipped: summary.skipped,
    results: summary.results.map((result) => ({
      fieldId: result.fieldId,
      fieldName: getFieldTypeLabel(result.fieldType),
      controlKind: result.controlKind,
      fieldType: result.fieldType,
      confidence: result.confidence,
      status: result.status,
      fillable: result.fillable,
      skipReason: result.skipReason,
      evidence: result.evidence,
      resolutionLayer: result.resolutionLayer,
      layer2Match: result.layer2Match
        ? {
            candidateText: result.layer2Match.candidateText,
            lcaDistance: result.layer2Match.lcaDistance,
            sameGroup: result.layer2Match.sameGroup,
            lexicalTopType: result.layer2Match.lexicalTopType,
            lexicalScore: result.layer2Match.lexicalScore,
            combinedScore: result.layer2Match.combinedScore
          }
        : undefined
    })),
    fillActions: summary.fillActions
  }
}
