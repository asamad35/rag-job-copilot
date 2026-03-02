import {
  delay,
  dispatchComboboxOptionPointerEvents,
  getComboboxOptionTexts,
  isPlaceholderOptionText,
  normalizeMatchText,
  pickRepresentativeNumber,
  scoreOptionTextMatch,
  setNativeValue
} from "~src/content/autofill/layer1/fill-utils"
import { AutofillValue } from "~src/content/autofill/types"

const COMBOBOX_OPTION_SELECTOR =
  "[role='option'], [aria-selected][id*='option'], [class*='select__option']"
const BUTTON_COMBOBOX_OPTION_SELECTOR =
  "[role='option'], [cmdk-item], [data-radix-collection-item], [class*='select__option'], [data-value]"
const BUTTON_COMBOBOX_INPUT_SELECTOR =
  "input[cmdk-input], input[role='combobox'], input[type='text'], input[type='search']"

const COMBOBOX_OPEN_WAIT_MS = 520
const COMBOBOX_POLL_INTERVAL_MS = 40

export const isComboboxInput = (element: Element): element is HTMLInputElement => {
  if (!(element instanceof HTMLInputElement)) {
    return false
  }

  const role = element.getAttribute("role")
  if (role === "combobox" || role === "listbox") {
    return true
  }

  if (element.hasAttribute("aria-autocomplete")) {
    return true
  }

  return false
}

export const isButtonCombobox = (
  element: Element
): element is HTMLButtonElement => {
  if (!(element instanceof HTMLButtonElement) && element.tagName !== "DIV") {
    return false
  }

  const role = element.getAttribute("role")
  if (role === "combobox") {
    return true
  }

  if (element.hasAttribute("aria-haspopup") && element.hasAttribute("aria-expanded")) {
    return true
  }

  return false
}

export const getComboboxContextToken = (input: HTMLInputElement): string => {
  return [input.id, input.getAttribute("aria-owns"), input.getAttribute("aria-controls")]
    .filter(Boolean)
    .join(" ")
}

export const getVisibleComboboxOptions = (input: HTMLInputElement): HTMLElement[] => {
  const contextToken = getComboboxContextToken(input)

  let container = document.body
  if (contextToken) {
    const listbox =
      document.getElementById(contextToken.split(" ")[0] ?? "") ??
      document.querySelector(`[id*="${contextToken.split(" ")[0] ?? ""}"]`)
    if (listbox) {
      container = (listbox.closest("[role='presentation'], dialog, body") as HTMLElement) ?? document.body
    }
  }

  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>(COMBOBOX_OPTION_SELECTOR)
  )

  const visibleCandidates = candidates.filter((el) => {
    const style = window.getComputedStyle(el)
    return style.display !== "none" && style.visibility !== "hidden"
  })

  if (visibleCandidates.length > 0) {
    return visibleCandidates
  }

  let current: HTMLElement | null = input
  for (let depth = 0; depth < 5; depth += 1) {
    if (!current) {
      break
    }
    const parentOptions = Array.from(
      current.querySelectorAll<HTMLElement>(COMBOBOX_OPTION_SELECTOR)
    )
    if (parentOptions.length > 0) {
      return parentOptions
    }
    current = current.parentElement
  }

  return []
}

export const openComboboxOptions = async (input: HTMLInputElement): Promise<void> => {
  input.focus()

  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", bubbles: true })
  )
  input.dispatchEvent(
    new KeyboardEvent("keyup", { key: "ArrowDown", code: "ArrowDown", bubbles: true })
  )

  input.dispatchEvent(new Event("focus", { bubbles: true }))
  input.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
  input.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }))
  input.dispatchEvent(new MouseEvent("click", { bubbles: true }))

  await delay(COMBOBOX_OPEN_WAIT_MS)
}

export const waitForComboboxOptions = async (input: HTMLInputElement): Promise<void> => {
  const maxAttempts = Math.ceil(COMBOBOX_OPEN_WAIT_MS / COMBOBOX_POLL_INTERVAL_MS)

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const options = getVisibleComboboxOptions(input)
    if (options.length > 0) {
      break
    }
    await delay(COMBOBOX_POLL_INTERVAL_MS)
  }
}

export const getBestMatchingComboboxOption = (
  input: HTMLInputElement,
  profileValue: AutofillValue | undefined,
  toProfileStringValues: (val: AutofillValue | undefined) => string[]
): HTMLElement | null => {
  const options = getVisibleComboboxOptions(input)
  if (options.length === 0) {
    return null
  }

  const profileValues = toProfileStringValues(profileValue)
    .map((val) => normalizeMatchText(val))
    .filter(Boolean)
  const profileNumber = pickRepresentativeNumber(profileValues)

  if (profileValues.length === 0 && profileNumber === null) {
    return null
  }

  let bestOption: HTMLElement | null = null
  let bestScore = 0

  for (const option of options) {
    const optionTexts = getComboboxOptionTexts(option)
    const normalizedOptionTexts = optionTexts.map(normalizeMatchText).filter(Boolean)

    if (normalizedOptionTexts.length === 0) {
      continue
    }

    if (normalizedOptionTexts.every(isPlaceholderOptionText)) {
      continue
    }

    const score = scoreOptionTextMatch(
      normalizedOptionTexts,
      optionTexts,
      profileValues,
      profileNumber
    )

    if (score > bestScore) {
      bestScore = score
      bestOption = option
    }
  }

  return bestScore > 0 ? bestOption : null
}

export const isComboboxSelectionCommitted = (input: HTMLInputElement): boolean => {
  const currentInputValue = input.value.trim()
  if (currentInputValue.length > 0) {
    return true
  }

  const role = input.getAttribute("role")
  if (role === "combobox" && input.parentElement) {
    const selectedItem = input.parentElement.querySelector("[data-selected]")
    if (selectedItem) {
      return true
    }
  }

  return false
}

export const commitComboboxWithKeyboard = async (
  input: HTMLInputElement
): Promise<boolean> => {
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true })
  )
  input.dispatchEvent(
    new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true })
  )

  await delay(100)
  return isComboboxSelectionCommitted(input)
}

export const applyToCombobox = async (
  input: HTMLInputElement,
  profileValue: AutofillValue | undefined,
  toProfileStringValues: (val: AutofillValue | undefined) => string[]
): Promise<boolean> => {
  const initialOptions = getVisibleComboboxOptions(input)

  if (initialOptions.length === 0) {
    await openComboboxOptions(input)
    await waitForComboboxOptions(input)
  }

  const bestOption = getBestMatchingComboboxOption(
    input,
    profileValue,
    toProfileStringValues
  )

  if (!bestOption) {
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true })
    )
    return false
  }

  const optionTexts = getComboboxOptionTexts(bestOption)
  const preferredText = optionTexts[0]

  if (preferredText) {
    setNativeValue(input, preferredText)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  }

  dispatchComboboxOptionPointerEvents(bestOption)
  bestOption.click()

  const handledByClick = isComboboxSelectionCommitted(input)
  if (handledByClick) {
    return true
  }

  return commitComboboxWithKeyboard(input)
}

export const findAssociatedSelectForComboboxButton = (
  button: HTMLButtonElement | HTMLElement
): HTMLSelectElement | null => {
  if (button.tagName === "SELECT") {
    return button as HTMLSelectElement
  }

  const nameAttr = button.getAttribute("name")
  if (nameAttr) {
    const select = document.querySelector(`select[name="${nameAttr}"]`)
    if (select instanceof HTMLSelectElement) {
      return select
    }
  }

  const nextElement = button.nextElementSibling
  if (nextElement instanceof HTMLSelectElement) {
    return nextElement
  }

  let wrapper = button.parentElement
  for (let limit = 0; limit < 3; limit += 1) {
    if (!wrapper) {
      break
    }
    const select = wrapper.querySelector("select")
    if (select) {
      return select
    }
    wrapper = wrapper.parentElement
  }

  const parentForm = button.closest("form")
  if (parentForm) {
    const rawId = button.getAttribute("id") ?? ""
    const fallbackSelect = parentForm.querySelector(`select[id*="${rawId}"]`)
    if (fallbackSelect instanceof HTMLSelectElement) {
      return fallbackSelect
    }
  }

  return null
}

export const collectVisibleButtonComboboxInputs = (): HTMLInputElement[] => {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(BUTTON_COMBOBOX_INPUT_SELECTOR)
  ).filter((input) => {
    const style = window.getComputedStyle(input)
    return style.display !== "none" && style.visibility !== "hidden"
  })
}

export const getButtonComboboxOptions = (
  button: HTMLButtonElement | HTMLElement,
  beforeOptions: ReadonlySet<HTMLElement>
): HTMLElement[] => {
  const controlsId = button.getAttribute("aria-controls")
  const ownsId = button.getAttribute("aria-owns")
  const targetId = controlsId ?? ownsId

  if (targetId) {
    const listbox = document.getElementById(targetId)
    if (listbox) {
      return Array.from(
        listbox.querySelectorAll<HTMLElement>(BUTTON_COMBOBOX_OPTION_SELECTOR)
      )
    }
  }

  const allElements = Array.from(
    document.querySelectorAll<HTMLElement>(BUTTON_COMBOBOX_OPTION_SELECTOR)
  )
  const newElements = allElements.filter((el) => !beforeOptions.has(el))

  if (newElements.length > 0) {
    return newElements
  }

  const visibleElements = allElements.filter((el) => {
    const style = window.getComputedStyle(el)
    return style.display !== "none" && style.visibility !== "hidden"
  })

  return visibleElements
}

export const getBestMatchingOptionFromList = (
  options: HTMLElement[],
  profileValue: AutofillValue | undefined,
  toProfileStringValues: (val: AutofillValue | undefined) => string[]
): HTMLElement | null => {
  if (options.length === 0) {
    return null
  }

  const profileValues = toProfileStringValues(profileValue)
    .map((val) => normalizeMatchText(val))
    .filter(Boolean)
  const profileNumber = pickRepresentativeNumber(profileValues)

  if (profileValues.length === 0 && profileNumber === null) {
    return null
  }

  let bestOption: HTMLElement | null = null
  let bestScore = 0

  for (const option of options) {
    const optionTexts = getComboboxOptionTexts(option)
    const normalizedOptionTexts = optionTexts.map(normalizeMatchText).filter(Boolean)

    if (normalizedOptionTexts.length === 0) {
      continue
    }

    if (normalizedOptionTexts.every(isPlaceholderOptionText)) {
      continue
    }

    const score = scoreOptionTextMatch(
      normalizedOptionTexts,
      optionTexts,
      profileValues,
      profileNumber
    )

    if (score > bestScore) {
      bestScore = score
      bestOption = option
    }
  }

  return bestScore > 0 ? bestOption : null
}

export const isButtonComboboxCommitted = (
  button: HTMLButtonElement | HTMLElement,
  previousText: string
): boolean => {
  const currentText = (button.textContent ?? "").trim()
  if (currentText !== previousText && currentText.length > 0) {
    return true
  }

  if (button.hasAttribute("data-value") || button.hasAttribute("data-state")) {
    return true
  }

  return false
}

export const applyToButtonCombobox = async (
  button: HTMLButtonElement | HTMLElement,
  profileValue: AutofillValue | undefined,
  toProfileStringValues: (val: AutofillValue | undefined) => string[],
  applyToSelect: (e: HTMLSelectElement, p: AutofillValue | undefined) => boolean
): Promise<boolean> => {
  const initialText = (button.textContent ?? "").trim()
  const beforeOptions = new Set(
    Array.from(document.querySelectorAll<HTMLElement>(BUTTON_COMBOBOX_OPTION_SELECTOR))
  )

  const associatedSelect = findAssociatedSelectForComboboxButton(button)
  if (associatedSelect && applyToSelect(associatedSelect, profileValue)) {
    return true
  }

  button.focus()
  button.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true })
  )
  button.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, cancelable: true })
  )
  button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }))
  button.click()

  await delay(COMBOBOX_OPEN_WAIT_MS)

  const searchInputs = collectVisibleButtonComboboxInputs()
  if (searchInputs.length > 0) {
    const searchInput = searchInputs[0]
    if (searchInput) {
      const stringValues = toProfileStringValues(profileValue)
      const searchQuery = stringValues[0] ?? ""

      if (searchQuery) {
        setNativeValue(searchInput, searchQuery)
        searchInput.dispatchEvent(new Event("input", { bubbles: true }))
        await delay(COMBOBOX_POLL_INTERVAL_MS * 2)
      }
    }
  }

  const options = getButtonComboboxOptions(button, beforeOptions)
  const bestOption = getBestMatchingOptionFromList(
    options,
    profileValue,
    toProfileStringValues
  )

  if (!bestOption) {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true })
    )
    return false
  }

  dispatchComboboxOptionPointerEvents(bestOption)
  bestOption.click()

  await delay(100)

  if (isButtonComboboxCommitted(button, initialText)) {
    return true
  }

  return false
}
