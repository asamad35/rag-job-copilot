import {
  AutofillProfile,
  AutofillValue,
  ControlKind,
  FillActionResult,
  Layer1Result,
  LayerStatus
} from "~src/content/autofill/types"

const dispatchFieldEvents = (element: Element) => {
  element.dispatchEvent(new Event("input", { bubbles: true }))
  element.dispatchEvent(new Event("change", { bubbles: true }))
}

const setNativeValue = (
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
) => {
  const prototype = Object.getPrototypeOf(element) as {
    value?: { set?: (nextValue: string) => void }
  }
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value")

  if (descriptor?.set) {
    descriptor.set.call(element, value)
  } else {
    element.value = value
  }
}

const setNativeChecked = (element: HTMLInputElement, nextChecked: boolean) => {
  const prototype = Object.getPrototypeOf(element) as {
    checked?: { set?: (value: boolean) => void }
  }
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "checked")

  if (descriptor?.set) {
    descriptor.set.call(element, nextChecked)
  } else {
    element.checked = nextChecked
  }
}

const isInputWithBooleanValue = (
  element: Element
): element is HTMLInputElement =>
  element instanceof HTMLInputElement &&
  (element.type.toLowerCase() === "checkbox" ||
    element.type.toLowerCase() === "radio")

const toStringValue = (
  value: AutofillValue | undefined
): string | undefined => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }

  return undefined
}

const toBooleanValue = (
  value: AutofillValue | undefined
): boolean | undefined => {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "true" || normalized === "yes" || normalized === "1") {
      return true
    }
    if (normalized === "false" || normalized === "no" || normalized === "0") {
      return false
    }
  }

  return undefined
}

const applyToSelect = (element: HTMLSelectElement, value: string) => {
  const normalizedTarget = value.trim().toLowerCase()

  const optionMatch = Array.from(element.options).find((option) => {
    const valueMatch = option.value.trim().toLowerCase() === normalizedTarget
    const labelMatch = option.label.trim().toLowerCase() === normalizedTarget
    const textMatch = option.text.trim().toLowerCase() === normalizedTarget
    return valueMatch || labelMatch || textMatch
  })

  setNativeValue(element, optionMatch?.value ?? value)
}

const applyToCustomElement = (element: HTMLElement, value: string): boolean => {
  if (element.isContentEditable) {
    element.textContent = value
    dispatchFieldEvents(element)
    return true
  }

  if ("value" in element) {
    const valueCarrier = element as HTMLElement & { value: string }
    valueCarrier.value = value
    dispatchFieldEvents(element)
    return true
  }

  return false
}

const fillFieldValue = (
  result: Layer1Result,
  value: AutofillValue | undefined
): FillActionResult => {
  if (result.status !== LayerStatus.Resolved) {
    return {
      fieldId: result.fieldId,
      fieldType: result.fieldType,
      filled: false,
      reason: "Field is not resolved at Layer 1."
    }
  }

  if (!result.fillable) {
    return {
      fieldId: result.fieldId,
      fieldType: result.fieldType,
      filled: false,
      reason: result.skipReason ?? "Field is not fillable."
    }
  }

  const { element } = result

  if (
    result.controlKind === ControlKind.Boolean ||
    isInputWithBooleanValue(element)
  ) {
    const booleanValue = toBooleanValue(value)
    if (typeof booleanValue !== "boolean") {
      return {
        fieldId: result.fieldId,
        fieldType: result.fieldType,
        filled: false,
        reason: "No compatible boolean profile value."
      }
    }

    if (!isInputWithBooleanValue(element)) {
      return {
        fieldId: result.fieldId,
        fieldType: result.fieldType,
        filled: false,
        reason: "Boolean control does not support checked assignment."
      }
    }

    setNativeChecked(element, booleanValue)
    dispatchFieldEvents(element)

    return {
      fieldId: result.fieldId,
      fieldType: result.fieldType,
      filled: true
    }
  }

  const stringValue = toStringValue(value)
  if (!stringValue) {
    return {
      fieldId: result.fieldId,
      fieldType: result.fieldType,
      filled: false,
      reason: "No compatible string profile value."
    }
  }

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    setNativeValue(element, stringValue)
    dispatchFieldEvents(element)
    return {
      fieldId: result.fieldId,
      fieldType: result.fieldType,
      filled: true
    }
  }

  if (element instanceof HTMLSelectElement) {
    applyToSelect(element, stringValue)
    dispatchFieldEvents(element)
    return {
      fieldId: result.fieldId,
      fieldType: result.fieldType,
      filled: true
    }
  }

  if (
    element instanceof HTMLElement &&
    applyToCustomElement(element, stringValue)
  ) {
    return {
      fieldId: result.fieldId,
      fieldType: result.fieldType,
      filled: true
    }
  }

  return {
    fieldId: result.fieldId,
    fieldType: result.fieldType,
    filled: false,
    reason: "Unsupported control type for fill operation."
  }
}

export const fillResolvedFields = (
  results: Layer1Result[],
  profile: AutofillProfile
): FillActionResult[] => {
  const actions: FillActionResult[] = []
  console.log({ results })
  for (const result of results) {
    const profileValue = profile[result.fieldType]
    actions.push(fillFieldValue(result, profileValue))
  }

  return actions
}
