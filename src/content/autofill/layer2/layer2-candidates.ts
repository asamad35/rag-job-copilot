import { LabelLikeCandidate } from "~src/content/autofill/types"
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
  /invalid/i,
  /error/i,
  /this field/i,
  /required field/i,
  /please enter/i,
  /must be/i,
  /cannot be/i
]

const toCollapsedText = (value: string): string => value.replace(/\s+/g, " ").trim()

const isVisible = (element: HTMLElement): boolean => {
  if (!element.isConnected) {
    return false
  }

  if (element.hidden) {
    return false
  }

  if (element.getAttribute("aria-hidden") === "true") {
    return false
  }

  const style = window.getComputedStyle(element)

  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.visibility !== "collapse"
  )
}

const isTechnicalTag = (element: HTMLElement): boolean =>
  TECHNICAL_TAGS.has(element.tagName.toLowerCase())

const isInteractiveElement = (element: HTMLElement): boolean =>
  element.matches(INTERACTIVE_SELECTOR)

const hasInteractiveDescendants = (element: HTMLElement): boolean =>
  element.querySelector(INTERACTIVE_SELECTOR) !== null

const hasInteractiveControlLabelAncestor = (element: HTMLElement): boolean => {
  const wrappingLabel = element.closest("label")

  if (!wrappingLabel) {
    return false
  }

  return wrappingLabel.querySelector("input, textarea, select, button") !== null
}

const isLikelyHelperText = (normalizedText: string): boolean => {
  if (!normalizedText) {
    return true
  }

  return HELPER_TEXT_PATTERNS.some((pattern) => pattern.test(normalizedText))
}

const getElementSiblingIndex = (element: HTMLElement): number => {
  let index = 1
  let current = element.previousElementSibling

  while (current) {
    if (current.tagName === element.tagName) {
      index += 1
    }
    current = current.previousElementSibling
  }

  return index
}

const buildElementFingerprint = (element: HTMLElement): string => {
  const parts: string[] = []
  let current: HTMLElement | null = element
  let depth = 0

  while (current && depth < 4) {
    const tag = current.tagName.toLowerCase()
    const index = getElementSiblingIndex(current)
    parts.push(`${tag}:${index}`)
    current = current.parentElement
    depth += 1
  }

  return parts.join("/")
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
  if (!isVisible(element)) {
    return false
  }

  if (isTechnicalTag(element)) {
    return false
  }

  if (isInteractiveElement(element)) {
    return false
  }

  if (hasInteractiveDescendants(element)) {
    return false
  }

  if (hasInteractiveControlLabelAncestor(element)) {
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
  const seen = new Set<string>()

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

    if (isLikelyHelperText(normalizedText)) {
      currentNode = walker.nextNode()
      continue
    }

    const candidateElement = toMeaningfulAncestor(textNode)

    if (!candidateElement || !isCandidateElementValid(candidateElement)) {
      currentNode = walker.nextNode()
      continue
    }

    const dedupeKey = `${normalizedText}|${buildElementFingerprint(candidateElement)}`

    if (seen.has(dedupeKey)) {
      currentNode = walker.nextNode()
      continue
    }

    seen.add(dedupeKey)
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
