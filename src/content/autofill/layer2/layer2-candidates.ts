import { LabelLikeCandidate } from "~src/content/autofill/types"
import { isElementVisible } from "~src/content/autofill/dom-utils"
import { normalizeText } from "~src/content/autofill/layer1/vocabulary"

const MIN_TEXT_LENGTH = 2
const MAX_TEXT_LENGTH = 180

const TECHNICAL_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "svg",
  "path",
  "code",
  "pre",
  "meta",
  "link",
  "head",
  "title"
])

const FORMAT_WRAPPER_TAGS = new Set([
  "strong",
  "em",
  "b",
  "i",
  "small",
  "mark",
  "u",
  "s",
  "sub",
  "sup"
])

const INTERACTIVE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "a[href]",
  "summary",
  "details",
  "[contenteditable='true']",
  "[contenteditable='plaintext-only']",
  "[tabindex]:not([tabindex='-1'])",
  "[role='button']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='combobox']",
  "[role='listbox']",
  "[role='menuitem']",
  "[role='option']",
  "[role='switch']",
  "[role='textbox']"
].join(",")

const HELPER_TEXT_PATTERNS = [
  /\bthis field\b/i,
  /\brequired field\b/i,
  /\binvalid characters?\b/i,
  /\bis required\b/i,
  /\bmust be at least\b/i,
  /\bcannot be empty\b/i
]

const HELPER_CLASS_PATTERNS = /error|invalid|helper|hint|warning|feedback/i
const OPTION_INPUT_TYPES = new Set(["checkbox", "radio"])
const OPTION_LIKE_ROLES = new Set([
  "checkbox",
  "radio",
  "option",
  "switch",
  "menuitemcheckbox",
  "menuitemradio"
])

const toCollapsedText = (value: string): string => value.replace(/\s+/g, " ").trim()

const isTechnicalTag = (element: HTMLElement): boolean =>
  TECHNICAL_TAGS.has(element.tagName.toLowerCase())

const isInteractiveElement = (element: HTMLElement): boolean =>
  element.matches(INTERACTIVE_SELECTOR)

const hasInteractiveAncestor = (element: HTMLElement): boolean =>
  element.parentElement?.closest(INTERACTIVE_SELECTOR) !== null

const hasInteractiveControlLabelAncestor = (element: HTMLElement): boolean => {
  const wrappingLabel = element.closest("label")

  if (!wrappingLabel) {
    return false
  }

  return wrappingLabel.querySelector("input, textarea, select, button") !== null
}

const hasOptionControlLabelForAncestor = (element: HTMLElement): boolean => {
  const wrappingLabel = element.closest("label")

  if (!(wrappingLabel instanceof HTMLLabelElement)) {
    return false
  }

  const targetId = wrappingLabel.htmlFor.trim()

  if (!targetId) {
    return false
  }

  const targetElement = wrappingLabel.ownerDocument.getElementById(targetId)

  if (!targetElement) {
    return false
  }

  if (targetElement instanceof HTMLInputElement) {
    return OPTION_INPUT_TYPES.has(targetElement.type.toLowerCase())
  }

  const role = targetElement.getAttribute("role")?.toLowerCase()

  return role ? OPTION_LIKE_ROLES.has(role) : false
}

const hasHelperClassOrId = (element: HTMLElement): boolean => {
  const classValue =
    typeof element.className === "string" ? element.className : ""
  const idValue = element.id ?? ""
  const dataErrorValue = element.getAttribute("data-error-for") ?? ""
  const dataQaValue = element.getAttribute("data-qa") ?? ""
  const merged = `${classValue} ${idValue} ${dataErrorValue} ${dataQaValue}`

  return HELPER_CLASS_PATTERNS.test(merged)
}

const isLikelyHelperText = (
  normalizedText: string,
  element: HTMLElement
): boolean => {
  if (!normalizedText) {
    return true
  }

  if (hasHelperClassOrId(element)) {
    return true
  }

  return HELPER_TEXT_PATTERNS.some((pattern) => pattern.test(normalizedText))
}

const hasSeenTextForElement = (
  seenByElement: WeakMap<HTMLElement, Set<string>>,
  element: HTMLElement,
  normalizedText: string
): boolean => {
  const seenTexts = seenByElement.get(element)

  if (seenTexts?.has(normalizedText)) {
    return true
  }

  if (!seenTexts) {
    seenByElement.set(element, new Set([normalizedText]))
    return false
  }

  seenTexts.add(normalizedText)
  return false
}

const toMeaningfulAncestor = (textNode: Text): HTMLElement | null => {
  let current = textNode.parentElement

  while (current) {
    if (isTechnicalTag(current)) {
      return null
    }

    if (FORMAT_WRAPPER_TAGS.has(current.tagName.toLowerCase())) {
      current = current.parentElement
      continue
    }

    return current
  }

  return null
}

const isCandidateElementValid = (element: HTMLElement): boolean => {
  if (!isElementVisible(element)) {
    return false
  }

  if (isTechnicalTag(element)) {
    return false
  }

  if (isInteractiveElement(element)) {
    return false
  }

  if (hasInteractiveAncestor(element)) {
    return false
  }

  if (hasInteractiveControlLabelAncestor(element)) {
    return false
  }

  if (hasOptionControlLabelForAncestor(element)) {
    return false
  }

  return true
}

const getWalkerRoot = (documentRoot: Document): Node =>
  documentRoot.body ?? documentRoot.documentElement

export const collectLabelLikeCandidates = (
  documentRoot: Document
): LabelLikeCandidate[] => {
  const root = getWalkerRoot(documentRoot)
  const walker = documentRoot.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const candidates: LabelLikeCandidate[] = []
  const seenByElement = new WeakMap<HTMLElement, Set<string>>()

  let currentNode = walker.nextNode()

  while (currentNode) {
    const textNode = currentNode as Text
    const rawText = toCollapsedText(textNode.nodeValue ?? "")

    if (!rawText) {
      currentNode = walker.nextNode()
      continue
    }

    const normalizedText = normalizeText(rawText)

    if (
      normalizedText.length < MIN_TEXT_LENGTH ||
      normalizedText.length > MAX_TEXT_LENGTH
    ) {
      currentNode = walker.nextNode()
      continue
    }

    const candidateElement = toMeaningfulAncestor(textNode)

    if (!candidateElement || !isCandidateElementValid(candidateElement)) {
      currentNode = walker.nextNode()
      continue
    }

    if (isLikelyHelperText(normalizedText, candidateElement)) {
      currentNode = walker.nextNode()
      continue
    }

    // De-duplicate only within the exact same container element.
    if (hasSeenTextForElement(seenByElement, candidateElement, normalizedText)) {
      currentNode = walker.nextNode()
      continue
    }
    candidates.push({
      textNode,
      element: candidateElement,
      text: rawText,
      normalizedText,
      tagName: candidateElement.tagName.toLowerCase(),
      textLength: normalizedText.length
    })

    currentNode = walker.nextNode()
  }

  return candidates
}
