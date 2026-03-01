import {
  ARIA_FIELD_SELECTOR,
  CONTENT_EDITABLE_SELECTOR,
  isElementVisible,
  NATIVE_FIELD_SELECTOR
} from "~src/content/autofill/dom-utils"
import {
  ControlKind,
  DiscoveredField,
  FieldElement
} from "~src/content/autofill/types"

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

const ASHBY_AUTOFILL_CLASS_FRAGMENT = "ashby-application-form-autofill"
const CAPTCHA_HINT_TERMS = [
  "captcha",
  "recaptcha",
  "hcaptcha",
  "g-recaptcha-response",
  "security code",
  "verification code"
]
const LEGAL_CONSENT_HINT_TERMS = [
  "consent",
  "terms",
  "privacy",
  "policy",
  "gdpr",
  "acknowledge",
  "candidateconsent"
]

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

const isDisabledOrReadonly = (element: FieldElement): boolean => {
  const isLikelyDatepickerReadonlyInput = (
    inputElement: HTMLInputElement
  ): boolean => {
    if (!inputElement.readOnly) {
      return false
    }

    const context = [
      inputElement.name,
      inputElement.id,
      inputElement.className,
      inputElement.getAttribute("aria-label") ?? "",
      inputElement.getAttribute("placeholder") ?? ""
    ]
      .join(" ")
      .toLowerCase()

    return (
      context.includes("date") ||
      context.includes("dob") ||
      context.includes("birth") ||
      context.includes("datepicker")
    )
  }

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    if (element.disabled) {
      return true
    }

    if (
      element instanceof HTMLInputElement &&
      isLikelyDatepickerReadonlyInput(element)
    ) {
      return false
    }

    if (element.readOnly) {
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
  element instanceof HTMLElement
    ? element.getAttribute("role")?.toLowerCase() ?? ""
    : ""

const classifyControlKind = (element: FieldElement): ControlKind => {
  if (element instanceof HTMLInputElement) {
    const inputType = element.type.toLowerCase()
    const role = element.getAttribute("role")?.toLowerCase() ?? ""

    if (BOOLEAN_INPUT_TYPES.has(inputType)) {
      return ControlKind.Boolean
    }

    if (inputType === "file") {
      return ControlKind.File
    }

    if (CHOICE_INPUT_TYPES.has(inputType)) {
      return ControlKind.Choice
    }

    if (role === "combobox" || role === "listbox") {
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

const normalizeContextText = (rawValue: string): string =>
  rawValue
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")

const contextHasAnyTerm = (
  normalizedContext: string,
  terms: readonly string[]
): boolean => terms.some((term) => normalizedContext.includes(term))

const getElementContextText = (element: FieldElement): string => {
  if (!(element instanceof HTMLElement)) {
    return ""
  }

  return normalizeContextText(
    [
      element.getAttribute("name") ?? "",
      element.getAttribute("id") ?? "",
      element.className,
      element.getAttribute("aria-label") ?? "",
      element.getAttribute("placeholder") ?? "",
      element.getAttribute("data-type") ?? "",
      element.getAttribute("data-category") ?? "",
      element.closest("label")?.textContent ?? ""
    ]
      .filter(Boolean)
      .join(" ")
  )
}

const canAutofill = (element: FieldElement): [boolean, string?] => {
  const normalizedContext = getElementContextText(element)

  if (
    normalizedContext &&
    contextHasAnyTerm(normalizedContext, CAPTCHA_HINT_TERMS)
  ) {
    return [false, "Field looks like CAPTCHA/verification and is intentionally skipped."]
  }

  if (element instanceof HTMLInputElement) {
    const inputType = element.type.toLowerCase()
    const isBooleanInput = BOOLEAN_INPUT_TYPES.has(inputType)

    if (
      isBooleanInput &&
      normalizedContext &&
      contextHasAnyTerm(normalizedContext, LEGAL_CONSENT_HINT_TERMS)
    ) {
      return [false, "Legal consent checkbox is intentionally left for explicit user action."]
    }
  }

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

const isAshbyAutofillWidgetControl = (element: FieldElement): boolean =>
  element instanceof HTMLElement &&
  Boolean(
    element.closest(`[class*="${ASHBY_AUTOFILL_CLASS_FRAGMENT}"]`)
  )

const getBooleanGroupKey = (element: FieldElement): string | null => {
  if (!(element instanceof HTMLInputElement)) {
    return null
  }

  const inputType = element.type.toLowerCase()
  if (!BOOLEAN_INPUT_TYPES.has(inputType)) {
    return null
  }

  const labeledOptionMatch = element.id.match(
    /^(.*)-labeled-(?:radio|checkbox)-\d+$/
  )
  if (labeledOptionMatch?.[1]) {
    return `choice-id:${labeledOptionMatch[1]}`
  }

  if (element.name.trim()) {
    return `${inputType}-name:${element.name.trim()}`
  }

  const groupContainer = element.closest(
    "fieldset, [role='radiogroup'], [role='group'], .ashby-application-form-field-entry"
  )
  if (groupContainer instanceof HTMLElement) {
    if (groupContainer.id.trim()) {
      return `${inputType}-group-id:${groupContainer.id.trim()}`
    }

    const groupText = groupContainer.textContent?.replace(/\s+/g, " ").trim()
    if (groupText) {
      return `${inputType}-group-text:${groupText.slice(0, 120)}`
    }
  }

  return null
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

export const discoverFormFields = (
  documentRoot: Document
): DiscoveredField[] => {
  const fields = getFieldCollections(documentRoot)
  const discovered: DiscoveredField[] = []
  const seenBooleanGroupKeys = new Set<string>()

  for (const [index, element] of fields.entries()) {
    if (isActionControl(element)) {
      continue
    }

    if (!isElementVisible(element)) {
      continue
    }

    if (isDisabledOrReadonly(element)) {
      continue
    }

    if (isAshbyAutofillWidgetControl(element)) {
      continue
    }

    const controlKind = classifyControlKind(element)

    if (controlKind === ControlKind.Boolean) {
      const booleanGroupKey = getBooleanGroupKey(element)
      if (booleanGroupKey) {
        if (seenBooleanGroupKeys.has(booleanGroupKey)) {
          continue
        }
        seenBooleanGroupKeys.add(booleanGroupKey)
      }
    }

    const [fillable, skipReason] = canAutofill(element)
    if (!fillable) {
      continue
    }

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
