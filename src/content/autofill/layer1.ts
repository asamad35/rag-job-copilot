import { scoreLayer1Signals } from "~src/content/autofill/scoring"
import {
  DiscoveredField,
  ExtractedSignals,
  Layer1Result,
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

  return signals
}

export const evaluateFieldWithLayer1 = (
  field: DiscoveredField
): Layer1Result => {
  const signals = extractSignalsForField(field)
  const scored = scoreLayer1Signals(signals)

  return {
    fieldId: field.id,
    element: field.element,
    controlKind: field.controlKind,
    fillable: field.fillable,
    skipReason: field.skipReason,
    signals,
    ...scored
  }
}
