import {
  ControlKind,
  DiscoveredField,
  FieldElement
} from "~src/content/autofill/types"

const NATIVE_FIELD_SELECTOR = "input:not([type='hidden']), textarea, select"

const ARIA_FIELD_SELECTOR = [
  "[role='textbox']",
  "[role='combobox']",
  "[role='listbox']",
  "[role='spinbutton']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='slider']"
].join(",")

const CONTENT_EDITABLE_SELECTOR = "[contenteditable]:not([contenteditable='false'])"

const ACTION_INPUT_TYPES = new Set(["submit", "reset", "button", "image"])

const BOOLEAN_INPUT_TYPES = new Set(["checkbox", "radio"])

const CHOICE_INPUT_TYPES = new Set([
  "date",
  "datetime-local",
  "month",
  "week",
  "time",
  "range",
  "color"
])

const isNativeFieldElement = (element: Element): element is FieldElement =>
  element instanceof HTMLInputElement ||
  element instanceof HTMLTextAreaElement ||
  element instanceof HTMLSelectElement ||
  element instanceof HTMLElement

const isActionControl = (element: FieldElement): boolean => {
  if (element instanceof HTMLInputElement) {
    return ACTION_INPUT_TYPES.has(element.type.toLowerCase())
  }

  return false
}

const isElementHidden = (element: FieldElement): boolean => {
  if (!element.isConnected) {
    return true
  }

  if (!(element instanceof HTMLElement)) {
    return false
  }

  if (element.hidden) {
    return true
  }

  const computedStyle = window.getComputedStyle(element)

  return (
    computedStyle.display === "none" ||
    computedStyle.visibility === "hidden" ||
    computedStyle.visibility === "collapse"
  )
}

const isDisabledOrReadonly = (element: FieldElement): boolean => {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.disabled || element.readOnly) {
      return true
    }
  }

  if (element instanceof HTMLSelectElement && element.disabled) {
    return true
  }

  if (!(element instanceof HTMLElement)) {
    return false
  }

  const ariaDisabled = element.getAttribute("aria-disabled")
  const ariaReadonly = element.getAttribute("aria-readonly")

  return ariaDisabled === "true" || ariaReadonly === "true"
}

const getRole = (element: FieldElement): string =>
  element instanceof HTMLElement ? element.getAttribute("role")?.toLowerCase() ?? "" : ""

const classifyControlKind = (element: FieldElement): ControlKind => {
  if (element instanceof HTMLInputElement) {
    const inputType = element.type.toLowerCase()

    if (BOOLEAN_INPUT_TYPES.has(inputType)) {
      return ControlKind.Boolean
    }

    if (inputType === "file") {
      return ControlKind.File
    }

    if (CHOICE_INPUT_TYPES.has(inputType)) {
      return ControlKind.Choice
    }

    return ControlKind.Textual
  }

  if (element instanceof HTMLTextAreaElement) {
    return ControlKind.Textual
  }

  if (element instanceof HTMLSelectElement) {
    return ControlKind.Choice
  }

  const role = getRole(element)

  if (role === "checkbox" || role === "radio") {
    return ControlKind.Boolean
  }

  if (role === "combobox" || role === "listbox" || role === "slider") {
    return ControlKind.Choice
  }

  if (role === "textbox" || role === "spinbutton") {
    return ControlKind.Textual
  }

  if (element instanceof HTMLElement && element.isContentEditable) {
    return ControlKind.Textual
  }

  return ControlKind.Custom
}

const canAutofill = (element: FieldElement, controlKind: ControlKind): [boolean, string?] => {
  if (element instanceof HTMLElement) {
    const blockedByPolicy =
      element.getAttribute("autocomplete")?.toLowerCase() === "off" &&
      element.hasAttribute("data-autofill-blocked")

    if (blockedByPolicy) {
      return [false, "Field is blocked by site autofill policy markers."]
    }
  }

  return [true]
}

const getFieldCollections = (documentRoot: Document): FieldElement[] => {
  const seen = new Set<Element>()
  const elements: FieldElement[] = []

  const pushElement = (element: Element) => {
    if (!isNativeFieldElement(element) || seen.has(element)) {
      return
    }

    seen.add(element)
    elements.push(element)
  }

  documentRoot.querySelectorAll(NATIVE_FIELD_SELECTOR).forEach(pushElement)
  documentRoot.querySelectorAll(ARIA_FIELD_SELECTOR).forEach(pushElement)
  documentRoot.querySelectorAll(CONTENT_EDITABLE_SELECTOR).forEach(pushElement)

  return elements
}

export const discoverFormFields = (documentRoot: Document): DiscoveredField[] => {
  const fields = getFieldCollections(documentRoot)
  const discovered: DiscoveredField[] = []

  for (const [index, element] of fields.entries()) {
    if (isActionControl(element)) {
      continue
    }

    if (isElementHidden(element)) {
      continue
    }

    if (isDisabledOrReadonly(element)) {
      continue
    }

    const controlKind = classifyControlKind(element)
    const [fillable, skipReason] = canAutofill(element, controlKind)

    discovered.push({
      id: `field-${index + 1}`,
      element,
      controlKind,
      fillable,
      skipReason
    })
  }

  return discovered
}
