import { discoverFormFields } from "~src/content/autofill/field-discovery"
import { fillResolvedFields } from "~src/content/autofill/fill"
import { evaluateFieldWithLayer1 } from "~src/content/autofill/layer1"
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

export const runLayer1Autofill = (
  profile: AutofillProfile,
  options: Layer1RunOptions = {}
): Layer1RunSummary => {
  const discoveredFields = discoverFormFields(document)
  const results = discoveredFields.map((field) =>
    evaluateFieldWithLayer1(field)
  )
  const fillActions = fillResolvedFields(results, profile)

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
    console.group("[Layer1 Autofill Summary]")
    console.info("Total fields:", summary.totalDiscovered)
    console.info("Resolved:", summary.resolved)
    console.info("Ambiguous:", summary.ambiguous)
    console.info("Unresolved:", summary.unresolved)
    console.info("Filled:", summary.filled)
    console.info("Skipped:", summary.skipped)
    console.groupEnd()
  }

  return summary
}

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
      evidence: result.evidence
    })),
    fillActions: summary.fillActions
  }
}
