import {
  applyToButtonCombobox,
  isButtonCombobox,
  isButtonComboboxCommitted,
  isComboboxInput,
  applyToCombobox
} from "~src/content/autofill/layer1/fill-combobox"
import {
  fillAshbyAutofillPaneResume,
  fillGoogleFormsResumeUpload,
  fillGooglePickerResumeUpload,
  fillResumeDropzoneResume,
  fillResumeFileInputFallback
} from "~src/content/autofill/layer1/fill-resume"
import {
  applyCountryCodeToSelect,
  findNearbyCountryCodeSelect,
  applyToCustomElement,
  applyToSelect,
  isInputWithBooleanValue,
  stripCountryCodePrefix
} from "~src/content/autofill/layer1/fill-select"
import {
  delay,
  emitKeyboardAction,
  hasPromptToken,
  resolveProfileValueForField,
  setNativeChecked,
  setNativeValue,
  toBooleanValue,
  toDateInputCandidateValues,
  toNumberInputValue,
  toProfileStringValues,
  toStringValue,
  PLACEHOLDER_OPTION_PATTERNS
} from "~src/content/autofill/layer1/fill-utils"
import {
  AutofillProfile,
  AutofillValue,
  ControlKind,
  FieldType,
  FillActionResult,
  Layer1Result,
  SignalType
} from "~src/content/autofill/types"
import { isElementVisible } from "~src/content/autofill/dom-utils"

const AGGRESSIVE_LABEL_FILL_MIN_CONFIDENCE = 0.7
const STRONG_LABEL_SIGNALS: readonly SignalType[] = [
  SignalType.LabelFor,
  SignalType.LabelWrap,
  SignalType.AriaLabelledBy
]

export const fillFieldValue = async (
  result: Layer1Result,
  value: AutofillValue | undefined,
  options: { allowNonResolved?: boolean } = {}
): Promise<FillActionResult> => {
  const element = document.getElementById(result.fieldId)

  const errorResult = (reason: string): FillActionResult => ({
    fieldId: result.fieldId,
    fieldType: result.fieldType,
    filled: false,
    reason
  })

  const successResult = (): FillActionResult => ({
    fieldId: result.fieldId,
    fieldType: result.fieldType,
    filled: true
  })

  if (!element) {
    return errorResult("Element not found")
  }

  if (result.fieldType === FieldType.Resume) {
    let uploadResult: FillActionResult | null = null

    try {
      uploadResult = await fillGooglePickerResumeUpload()

      if (!uploadResult?.filled) {
        uploadResult = await fillGoogleFormsResumeUpload()
      }

      if (!uploadResult?.filled) {
        uploadResult = fillAshbyAutofillPaneResume()
      }

      if (!uploadResult?.filled) {
        uploadResult = fillResumeDropzoneResume()
      }

      if (!uploadResult?.filled) {
        uploadResult = fillResumeFileInputFallback()
      }

      if (uploadResult) {
        return {
          ...uploadResult,
          fieldId: result.fieldId,
          fieldType: result.fieldType
        }
      }

      return errorResult("No resume upload strategy succeeded")
    } catch (err: unknown) {
      return errorResult(`Resume upload failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }

  if (value === undefined || value === null) {
    return errorResult("Value is empty")
  }

  if (isInputWithBooleanValue(element)) {
    const booleanValue = toBooleanValue(value)
    if (booleanValue !== undefined) {
      setNativeChecked(element as HTMLInputElement, booleanValue)
      element.dispatchEvent(new Event("change", { bubbles: true }))
      return successResult()
    }
    return errorResult("Could not map value to boolean")
  }

  if (element instanceof HTMLSelectElement) {
    const handledBySelect = applyToSelect(
      element,
      value,
      toProfileStringValues,
      PLACEHOLDER_OPTION_PATTERNS
    )
    return handledBySelect ? successResult() : errorResult("No matching select option")
  }

  if (isComboboxInput(element)) {
    const handledByCombobox = await applyToCombobox(
      element,
      value,
      toProfileStringValues
    )
    if (handledByCombobox) {
      return successResult()
    }
  }

  if (isButtonCombobox(element)) {
    const previousText = (element.textContent ?? "").trim()
    const handledByButton = await applyToButtonCombobox(
      element,
      value,
      toProfileStringValues,
      (e, p) => applyToSelect(e, p, toProfileStringValues, PLACEHOLDER_OPTION_PATTERNS)
    )

    if (handledByButton || isButtonComboboxCommitted(element, previousText)) {
      return successResult()
    }
  }

  if (result.controlKind === ControlKind.Custom) {
    const stringValue = toStringValue(value)
    if (stringValue) {
      applyToCustomElement(element, stringValue)
      return successResult()
    }
    return errorResult("Empty string value for custom element")
  }

  if (element instanceof HTMLInputElement && element.type === "date") {
    const candidateStrings = toDateInputCandidateValues(value)
    for (const stringValue of candidateStrings) {
      setNativeValue(element, stringValue)
      if (element.value) {
        element.dispatchEvent(new Event("input", { bubbles: true }))
        element.dispatchEvent(new Event("change", { bubbles: true }))
        return successResult()
      }
    }
    return errorResult("Could not format date for input")
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.type === "number" || hasPromptToken(result, ["number"])) {
      const numberString = toNumberInputValue(value)
      if (numberString) {
        setNativeValue(element, numberString)
        element.dispatchEvent(new Event("input", { bubbles: true }))
        return successResult()
      }
    }

    const stringValue = toStringValue(value)
    if (stringValue) {
      let finalValue = stringValue

      if (
        result.fieldType === FieldType.Phone ||
        element.type === "tel" ||
        hasPromptToken(result, ["phone", "mobile", "telephone"])
      ) {
        const countrySelect = findNearbyCountryCodeSelect(element as HTMLInputElement)
        if (countrySelect) {
          const appliedCode = applyCountryCodeToSelect(countrySelect, finalValue)
          if (appliedCode) {
            finalValue = stripCountryCodePrefix(finalValue, appliedCode)
          }
        }
      }

      setNativeValue(element, finalValue)
      element.dispatchEvent(new Event("input", { bubbles: true }))

      if (element.type === "tel") {
        emitKeyboardAction(element, " ", "Space")
        emitKeyboardAction(element, "Backspace", "Backspace")
      }

      return successResult()
    }
  }

  return errorResult("Unsupported control kind or element type")
}

export const hasStrongLabelSignals = (result: Layer1Result): boolean =>
  STRONG_LABEL_SIGNALS.some(
    (signalType) => (result.signals[signalType]?.length ?? 0) > 0
  )

export const shouldUseAggressiveLabelFill = (result: Layer1Result): boolean =>
  result.layer2Match === undefined &&
  result.confidence >= AGGRESSIVE_LABEL_FILL_MIN_CONFIDENCE &&
  result.confidence < 0.9 &&
  hasStrongLabelSignals(result)

export const fillResolvedFields = async (
  results: Layer1Result[],
  profile: AutofillProfile
): Promise<FillActionResult[]> => {
  const actions: FillActionResult[] = []
  const resolvedResults = results.filter((r) => {
    if (r.status === "resolved") {
      return true
    }
    if (shouldUseAggressiveLabelFill(r)) {
      return true
    }
    return false
  })

  resolvedResults.sort((left, right) => {
    const leftResume = left.fieldType === FieldType.Resume ? 1 : 0
    const rightResume = right.fieldType === FieldType.Resume ? 1 : 0
    return leftResume - rightResume
  })

  for (const result of resolvedResults) {
    const element = document.getElementById(result.fieldId)
    if (!element || (!isElementVisible(element) && result.fieldType !== FieldType.Resume)) {
      actions.push({
        fieldId: result.fieldId,
        fieldType: result.fieldType,
        filled: false,
        reason: "Element hidden or missing"
      })
      continue
    }

    try {
      const profileValue = resolveProfileValueForField(result, profile)
      const actionResult = await fillFieldValue(result, profileValue, {
        allowNonResolved: true
      })
      actions.push({ ...actionResult, fieldId: result.fieldId })
    } catch (err: unknown) {
      actions.push({
        fieldId: result.fieldId,
        fieldType: result.fieldType,
        filled: false,
        reason: err instanceof Error ? err.message : "Unknown error"
      })
    }

    await delay(Math.random() * 30 + 10)
  }

  return actions
}
