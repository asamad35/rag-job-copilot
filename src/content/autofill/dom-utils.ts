export const NATIVE_FIELD_SELECTOR = "input:not([type='hidden']), textarea, select"

export const ARIA_FIELD_SELECTOR = [
  "[role='textbox']",
  "[role='combobox']",
  "[role='listbox']",
  "[role='spinbutton']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='slider']"
].join(",")

export const CONTENT_EDITABLE_SELECTOR =
  "[contenteditable]:not([contenteditable='false'])"

export const DISCOVERABLE_FIELD_SELECTOR = [
  NATIVE_FIELD_SELECTOR,
  ARIA_FIELD_SELECTOR,
  CONTENT_EDITABLE_SELECTOR
].join(",")

const hasHiddenStyle = (style: CSSStyleDeclaration): boolean =>
  style.display === "none" ||
  style.visibility === "hidden" ||
  style.visibility === "collapse"

const isAriaHidden = (element: HTMLElement): boolean =>
  element.getAttribute("aria-hidden")?.toLowerCase() === "true"

export const isElementVisible = (element: HTMLElement): boolean => {
  if (!element.isConnected) {
    return false
  }

  let current: HTMLElement | null = element
  let elementStyle: CSSStyleDeclaration | null = null

  while (current) {
    if (current.hidden || current.hasAttribute("inert") || isAriaHidden(current)) {
      return false
    }

    const computedStyle = window.getComputedStyle(current)
    if (elementStyle === null) {
      elementStyle = computedStyle
    }

    if (hasHiddenStyle(computedStyle)) {
      return false
    }

    current = current.parentElement
  }

  if (!elementStyle) {
    return false
  }

  if (
    element.getClientRects().length === 0 &&
    elementStyle.position !== "fixed"
  ) {
    return false
  }

  return true
}
