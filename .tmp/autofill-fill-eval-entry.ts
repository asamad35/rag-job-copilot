import { runAutofillPipeline } from "~src/content/autofill/orchestrator"
import { DEFAULT_AUTOFILL_PROFILE } from "~src/content/autofill/profile"

declare global {
  interface Window {
    __runAutofillFillEval?: () => Promise<{
      totalDiscovered: number
      resolved: number
      ambiguous: number
      unresolved: number
      filled: number
      skipped: number
      fillActions: Array<{
        fieldType: string
        fieldId: string
        filled: boolean
        reason?: string
      }>
    }>
  }
}

window.__runAutofillFillEval = async () => {
  const summary = await runAutofillPipeline(DEFAULT_AUTOFILL_PROFILE, { debug: false })

  return {
    totalDiscovered: summary.totalDiscovered,
    resolved: summary.resolved,
    ambiguous: summary.ambiguous,
    unresolved: summary.unresolved,
    filled: summary.filled,
    skipped: summary.skipped,
    fillActions: summary.fillActions.map((action) => ({
      fieldType: action.fieldType,
      fieldId: action.fieldId,
      filled: action.filled,
      reason: action.reason
    }))
  }
}
