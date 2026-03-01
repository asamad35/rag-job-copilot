import { discoverFormFields } from "~src/content/autofill/layer1/field-discovery"
import { evaluateFieldWithLayer1 } from "~src/content/autofill/layer1/layer1"
import { refineResultsWithLayer2 } from "~src/content/autofill/layer2/layer2"
import { LayerStatus, Layer1ResultSnapshot } from "~src/content/autofill/types"
import { getFieldTypeLabel } from "~src/shared/field-labels"

declare global {
  interface Window {
    __runAutofillEval?: () => {
      totalDiscovered: number
      resolved: number
      ambiguous: number
      unresolved: number
      layer2Resolved: number
      results: Array<
        Layer1ResultSnapshot & {
          elementInfo: {
            tagName: string
            inputType?: string
            role?: string
            nameAttr?: string
            idAttr?: string
            placeholder?: string
            ariaLabel?: string
            autocomplete?: string
          }
        }
      >
    }
  }
}

const countByStatus = (
  results: Array<{ status: LayerStatus }>,
  status: LayerStatus
): number => results.filter((result) => result.status === status).length

const describeElement = (element: Element) => {
  const base = {
    tagName: element.tagName.toLowerCase(),
    inputType:
      element instanceof HTMLInputElement ? element.type.toLowerCase() : undefined,
    role: element.getAttribute("role") ?? undefined,
    nameAttr: element.getAttribute("name") ?? undefined,
    idAttr: element.getAttribute("id") ?? undefined,
    placeholder: element.getAttribute("placeholder") ?? undefined,
    ariaLabel: element.getAttribute("aria-label") ?? undefined,
    autocomplete: element.getAttribute("autocomplete") ?? undefined
  }

  return base
}

window.__runAutofillEval = () => {
  const discoveredFields = discoverFormFields(document)
  const layer1Results = discoveredFields.map((field) => evaluateFieldWithLayer1(field))
  const refinedResults = refineResultsWithLayer2(layer1Results, { debug: false })
  const discoveredById = new Map(discoveredFields.map((field) => [field.id, field]))

  const resolved = countByStatus(refinedResults, LayerStatus.Resolved)
  const ambiguous = countByStatus(refinedResults, LayerStatus.Ambiguous)
  const unresolved = countByStatus(refinedResults, LayerStatus.Unresolved)
  const layer2Resolved = refinedResults.filter(
    (result) => result.status === LayerStatus.Resolved && result.resolutionLayer === "layer2"
  ).length

  const snapshots = refinedResults.map((result) => ({
    elementInfo: describeElement(
      discoveredById.get(result.fieldId)?.element ?? (result.element as Element)
    ),
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
  }))

  return {
    totalDiscovered: discoveredFields.length,
    resolved,
    ambiguous,
    unresolved,
    layer2Resolved,
    results: snapshots
  }
}
