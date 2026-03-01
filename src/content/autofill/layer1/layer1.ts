import { DISCOVERABLE_FIELD_SELECTOR } from "~src/content/autofill/dom-utils"
import { scoreLayer1Signals } from "~src/content/autofill/layer1/scoring"
import {
  ControlKind,
  DiscoveredField,
  ExtractedSignals,
  FieldType,
  Layer1Result,
  LayerStatus,
  ScoredLayer1Field,
  SignalType
} from "~src/content/autofill/types"

const initializeSignals = (): ExtractedSignals => ({
  [SignalType.LabelFor]: [],
  [SignalType.LabelWrap]: [],
  [SignalType.AriaLabelledBy]: [],
  [SignalType.Autocomplete]: [],
  [SignalType.AriaLabel]: [],
  [SignalType.Name]: [],
  [SignalType.Id]: [],
  [SignalType.Placeholder]: []
})

const addUniqueSignal = (
  signals: ExtractedSignals,
  signalType: SignalType,
  rawValue: string | null | undefined
) => {
  if (!rawValue) {
    return
  }

  const trimmedValue = rawValue.trim()
  if (!trimmedValue) {
    return
  }

  if (!signals[signalType].includes(trimmedValue)) {
    signals[signalType].push(trimmedValue)
  }
}

const CONTEXT_SIGNAL_MAX_DEPTH = 4
const CONTEXT_SIGNAL_MAX_LENGTH = 140
const CONTEXT_SIGNAL_MIN_LENGTH = 2

const INTERACTIVE_CONTEXT_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "[role='button']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='combobox']",
  "[role='listbox']",
  "[role='option']"
].join(",")

const collapseText = (rawValue: string): string =>
  rawValue.replace(/\s+/g, " ").trim()

const toContextSignalText = (element: HTMLElement): string | null => {
  const text = collapseText(element.textContent ?? "")

  if (
    text.length < CONTEXT_SIGNAL_MIN_LENGTH ||
    text.length > CONTEXT_SIGNAL_MAX_LENGTH
  ) {
    return null
  }

  return text
}

const isContextSignalCandidate = (element: HTMLElement): boolean => {
  if (element.matches(INTERACTIVE_CONTEXT_SELECTOR)) {
    return false
  }

  if (element.querySelector(DISCOVERABLE_FIELD_SELECTOR)) {
    return false
  }

  return true
}

const extractAdjacentContextLabels = (
  field: DiscoveredField,
  signals: ExtractedSignals
) => {
  if (!(field.element instanceof HTMLElement)) {
    return
  }

  let current: HTMLElement | null = field.element

  for (
    let depth = 0;
    depth < CONTEXT_SIGNAL_MAX_DEPTH && current?.parentElement;
    depth += 1
  ) {
    const previousSibling = current.previousElementSibling

    if (
      previousSibling instanceof HTMLElement &&
      isContextSignalCandidate(previousSibling)
    ) {
      const contextText = toContextSignalText(previousSibling)
      if (contextText) {
        addUniqueSignal(signals, SignalType.LabelWrap, contextText)
      }
    }

    current = current.parentElement
  }
}

const isLabelableElement = (
  element: DiscoveredField["element"]
): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
  element instanceof HTMLInputElement ||
  element instanceof HTMLTextAreaElement ||
  element instanceof HTMLSelectElement

const extractLabelForValues = (
  field: DiscoveredField,
  signals: ExtractedSignals
) => {
  const { element } = field

  if (!isLabelableElement(element)) {
    return
  }

  if (element.labels) {
    for (const label of Array.from(element.labels)) {
      const text = label.textContent
      if (label.htmlFor) {
        addUniqueSignal(signals, SignalType.LabelFor, text)
      } else {
        addUniqueSignal(signals, SignalType.LabelWrap, text)
      }
    }
  }

  if (!element.id) {
    return
  }

  const safeId = window.CSS?.escape
    ? window.CSS.escape(element.id)
    : element.id.replace(/"/g, '\\"')

  const explicitLabels = element.ownerDocument.querySelectorAll(
    `label[for="${safeId}"]`
  )

  for (const label of Array.from(explicitLabels)) {
    addUniqueSignal(signals, SignalType.LabelFor, label.textContent)
  }
}

const extractWrappedLabelValue = (
  field: DiscoveredField,
  signals: ExtractedSignals
) => {
  if (!(field.element instanceof HTMLElement)) {
    return
  }

  const wrappedLabel = field.element.closest("label")
  addUniqueSignal(signals, SignalType.LabelWrap, wrappedLabel?.textContent)
}

const extractAriaLabelledByValues = (
  field: DiscoveredField,
  signals: ExtractedSignals
) => {
  if (!(field.element instanceof HTMLElement)) {
    return
  }

  const labelledBy = field.element.getAttribute("aria-labelledby")
  if (!labelledBy) {
    return
  }

  const referencedIds = labelledBy.split(/\s+/).filter(Boolean)

  for (const id of referencedIds) {
    const labelElement = field.element.ownerDocument.getElementById(id)
    addUniqueSignal(
      signals,
      SignalType.AriaLabelledBy,
      labelElement?.textContent
    )
  }
}

const extractAttributeSignals = (
  field: DiscoveredField,
  signals: ExtractedSignals
) => {
  const { element } = field

  if (element instanceof HTMLElement) {
    addUniqueSignal(
      signals,
      SignalType.Autocomplete,
      element.getAttribute("autocomplete")
    )
    addUniqueSignal(
      signals,
      SignalType.AriaLabel,
      element.getAttribute("aria-label")
    )
    addUniqueSignal(signals, SignalType.Name, element.getAttribute("name"))
    addUniqueSignal(signals, SignalType.Id, element.getAttribute("id"))
    addUniqueSignal(
      signals,
      SignalType.Placeholder,
      element.getAttribute("placeholder")
    )
  }

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    addUniqueSignal(signals, SignalType.Name, element.name)
    addUniqueSignal(signals, SignalType.Id, element.id)
  }

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    addUniqueSignal(signals, SignalType.Placeholder, element.placeholder)
  }
}

export const extractSignalsForField = (
  field: DiscoveredField
): ExtractedSignals => {
  const signals = initializeSignals()

  extractLabelForValues(field, signals)
  extractWrappedLabelValue(field, signals)
  extractAriaLabelledByValues(field, signals)
  extractAttributeSignals(field, signals)
  extractAdjacentContextLabels(field, signals)

  return signals
}

export const evaluateFieldWithLayer1 = (
  field: DiscoveredField
): Layer1Result => {
  const signals = extractSignalsForField(field)
  const scored = scoreLayer1Signals(signals)

  const normalizedScore: ScoredLayer1Field = (() => {
    if (field.controlKind !== ControlKind.File) {
      return scored
    }

    if (scored.fieldType !== FieldType.Resume) {
      return {
        ...scored,
        fieldType: FieldType.Unknown,
        confidence: 0,
        status: LayerStatus.Unresolved
      }
    }

    if (scored.status === LayerStatus.Resolved || scored.confidence < 0.85) {
      return scored
    }

    return {
      ...scored,
      status: LayerStatus.Resolved,
      confidence: Number(Math.max(scored.confidence, 0.9).toFixed(4))
    }
  })()

  return {
    fieldId: field.id,
    element: field.element,
    controlKind: field.controlKind,
    fillable: field.fillable,
    skipReason: field.skipReason,
    resolutionLayer: "layer1",
    signals,
    ...normalizedScore
  }
}
