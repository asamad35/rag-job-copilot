import {
  delay,
  normalizeMatchText,
  pickRepresentativeNumber,
  scoreOptionTextMatch
} from "~src/content/autofill/layer1/fill-utils"
import { AutofillValue } from "~src/content/autofill/types"

export const isInputWithBooleanValue = (
  element: Element
): element is HTMLInputElement => {
  if (!(element instanceof HTMLInputElement)) {
    return false
  }
  return element.type === "checkbox" || element.type === "radio"
}

export const isLikelyCountryCodeSelect = (select: HTMLSelectElement): boolean => {
  if (select.options.length === 0) {
    return false
  }

  const sampleSize = Math.min(10, select.options.length)
  let codeMatchCount = 0

  for (let index = 0; index < sampleSize; index += 1) {
    const option = select.options[index]
    if (!option) {
      continue
    }

    const value = option.value.trim()
    const text = (option.textContent ?? "").trim()

    if (value && /^(\+\d{1,4})$/.test(value)) {
      codeMatchCount += 1
      continue
    }

    if (text && /^(\+\d{1,4})/.test(text)) {
      codeMatchCount += 1
    }
  }

  return codeMatchCount >= Math.min(3, sampleSize)
}

export const findNearbyCountryCodeSelect = (
  phoneInput: HTMLInputElement | HTMLTextAreaElement
): HTMLSelectElement | null => {
  let current: HTMLElement | null = phoneInput

  for (let depth = 0; depth < 4; depth += 1) {
    if (!current) {
      break
    }

    const parent: HTMLElement | null = current.parentElement
    if (!parent || !(parent instanceof HTMLElement)) {
      break
    }

    const selects = Array.from(parent.querySelectorAll("select"))
    for (const select of selects) {
      if ((select as Element) !== (phoneInput as Element) && isLikelyCountryCodeSelect(select)) {
        return select
      }
    }

    current = parent
  }

  return null
}

export const stripCountryCodePrefix = (
  fullPhone: string,
  countryCode: string
): string => {
  let cleanPhone = fullPhone.replace(/[^\d+]/g, "")
  if (countryCode && cleanPhone.startsWith(countryCode)) {
    cleanPhone = cleanPhone.slice(countryCode.length)
  } else if (cleanPhone.startsWith("+")) {
    const match = cleanPhone.match(/^(\+\d{1,4})(.*)$/)
    if (match) {
      cleanPhone = match[2] ?? cleanPhone
    }
  }

  if (cleanPhone.startsWith("0")) {
    cleanPhone = cleanPhone.replace(/^0+/, "")
  }

  return cleanPhone
}

export const applyCountryCodeToSelect = (
  select: HTMLSelectElement,
  fullPhone: string
): string | null => {
  const match = fullPhone.replace(/[^\d+]/g, "").match(/^(\+\d{1,4})/)
  if (!match) {
    return null
  }

  const expectedCode = match[1] ?? ""
  let bestOption: HTMLOptionElement | null = null

  for (const option of Array.from(select.options)) {
    const value = option.value.trim()
    const text = (option.textContent ?? "").trim()

    if (value === expectedCode) {
      bestOption = option
      break
    }

    if (text.startsWith(expectedCode)) {
      bestOption = option
    }
  }

  if (bestOption) {
    select.value = bestOption.value
    select.dispatchEvent(new Event("change", { bubbles: true }))
    return expectedCode
  }

  return null
}

export const getComparableOptionTexts = (element: HTMLInputElement): string[] => {
  const values = new Set<string>()

  const pushIfPresent = (rawValue: string | null | undefined) => {
    const trimmed = rawValue?.trim()
    if (trimmed) {
      values.add(trimmed)
    }
  }

  pushIfPresent(element.value)
  pushIfPresent(element.placeholder)

  const parent = element.parentElement
  if (parent) {
    pushIfPresent(parent.textContent)
  }

  return Array.from(values)
}

export const isOptionMatchedByProfile = (
  element: HTMLInputElement,
  profileValue: AutofillValue | undefined,
  toProfileStringValues: (val: AutofillValue | undefined) => string[]
): boolean => {
  const profileValues = toProfileStringValues(profileValue)
    .map(normalizeMatchText)
    .filter(Boolean)

  if (profileValues.length === 0) {
    return false
  }

  const optionValues = getComparableOptionTexts(element)
    .map((value) => value.trim())
    .filter(Boolean)

  const normalizedOptionValues = optionValues.map(normalizeMatchText).filter(Boolean)

  if (normalizedOptionValues.length === 0) {
    return false
  }

  const profileNumber = pickRepresentativeNumber(profileValues)

  return scoreOptionTextMatch(
    normalizedOptionValues,
    optionValues,
    profileValues,
    profileNumber
  ) > 0
}

export const getSelectOptionTexts = (option: HTMLOptionElement): string[] => {
  const rawValues = [option.value, option.label, option.text]
  return rawValues.map((item) => item.trim()).filter(Boolean)
}

export const isPlaceholderSelectOption = (
  option: HTMLOptionElement,
  normalizedOptionTexts: string[],
  placeholders: readonly RegExp[]
): boolean => {
  if (option.disabled) {
    return true
  }

  if (option.value.trim().length > 0) {
    return false
  }

  if (normalizedOptionTexts.length === 0) {
    return true
  }

  return normalizedOptionTexts.some((text) =>
    placeholders.some((pattern) => pattern.test(text))
  )
}

export const getMatchingSelectOptionValues = (
  element: HTMLSelectElement,
  profileValue: AutofillValue | undefined,
  toProfileStringValues: (val: AutofillValue | undefined) => string[],
  placeholders: readonly RegExp[]
): string[] => {
  const profileValues = toProfileStringValues(profileValue)
    .map((value) => value.trim())
    .filter(Boolean)

  if (profileValues.length === 0) {
    return []
  }

  const normalizedProfileValues = profileValues
    .map(normalizeMatchText)
    .filter(Boolean)
  const profileNumber = pickRepresentativeNumber(normalizedProfileValues)

  const matchedValues = new Set<string>()

  for (const option of Array.from(element.options)) {
    const optionTexts = getSelectOptionTexts(option)
    const normalizedOptionTexts = optionTexts.map(normalizeMatchText).filter(Boolean)

    if (isPlaceholderSelectOption(option, normalizedOptionTexts, placeholders)) {
      continue
    }

    const matched = scoreOptionTextMatch(
      normalizedOptionTexts,
      optionTexts,
      normalizedProfileValues,
      profileNumber
    ) > 0

    if (matched) {
      matchedValues.add(option.value)
    }
  }

  return Array.from(matchedValues)
}

export const applyToSelect = (
  element: HTMLSelectElement,
  profileValue: AutofillValue | undefined,
  toProfileStringValues: (val: AutofillValue | undefined) => string[],
  placeholders: readonly RegExp[]
): boolean => {
  const matchedValues = getMatchingSelectOptionValues(
    element,
    profileValue,
    toProfileStringValues,
    placeholders
  )

  if (matchedValues.length > 0 && matchedValues[0] !== undefined) {
    element.value = matchedValues[0]
    element.dispatchEvent(new Event("change", { bubbles: true }))
    return true
  }

  return false
}

export const applyToCustomElement = (
  element: HTMLElement,
  value: string
): boolean => {
  if (element.isContentEditable) {
    element.textContent = value
    element.dispatchEvent(new Event("input", { bubbles: true }))
    return true
  }

  element.dataset.value = value
  return true
}
