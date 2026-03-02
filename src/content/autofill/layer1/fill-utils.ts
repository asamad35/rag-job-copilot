import {
  normalizeText,
  containsWholeToken
} from "~src/content/autofill/dom-utils"
import {
  AutofillProfile,
  AutofillValue,
  FieldType,
  Layer1Result
} from "~src/content/autofill/types"

export const dispatchFieldEvents = (element: Element) => {
  element.dispatchEvent(new Event("input", { bubbles: true }))
  element.dispatchEvent(new Event("change", { bubbles: true }))
}

export const normalizeMatchText = normalizeText

export const extractNumericValues = (value: string): number[] => {
  const matches = value.match(/\d+(?:\.\d+)?/g)
  if (!matches) {
    return []
  }

  return matches
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item))
}

interface ExperienceDuration {
  years: number
  months: number
}

const clampExperienceMonths = (months: number): number => {
  if (!Number.isFinite(months)) {
    return 0
  }

  if (months < 0) {
    return 0
  }

  if (months > 11) {
    return 11
  }

  return months
}

export const parseExperienceDuration = (
  value: AutofillValue | undefined
): ExperienceDuration | null => {
  const candidates = toProfileStringValues(value)
  if (candidates.length === 0) {
    return null
  }

  for (const rawValue of candidates) {
    const normalized = rawValue.trim().toLowerCase()
    if (!normalized) {
      continue
    }

    const yearsMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:\+?\s*)?(?:year|yr|yrs|years)\b/)
    const monthsMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:month|months|mo|mos)\b/)

    if (yearsMatch || monthsMatch) {
      const parsedYears = yearsMatch ? Number(yearsMatch[1]) : 0
      const parsedMonths = monthsMatch ? Number(monthsMatch[1]) : 0

      if (Number.isFinite(parsedYears) || Number.isFinite(parsedMonths)) {
        const years = Number.isFinite(parsedYears)
          ? Math.max(0, Math.floor(parsedYears))
          : 0
        const months = Number.isFinite(parsedMonths)
          ? clampExperienceMonths(Math.floor(parsedMonths))
          : 0
        return { years, months }
      }
    }
  }

  const numbers = candidates.flatMap(extractNumericValues)
  if (numbers.length >= 2) {
    return {
      years: Math.max(0, Math.floor(numbers[0] ?? 0)),
      months: clampExperienceMonths(Math.floor(numbers[1] ?? 0))
    }
  }

  if (numbers.length === 1) {
    return {
      years: Math.max(0, Math.floor(numbers[0] ?? 0)),
      months: 0
    }
  }

  return null
}

export const pickRepresentativeNumber = (normalizedValues: string[]): number | null => {
  for (const value of normalizedValues) {
    const numbers = extractNumericValues(value)
    if (numbers.length > 0) {
      return numbers[0]
    }
  }

  return null
}

export const matchesNumericRange = (rawOption: string, profileNumber: number): boolean => {
  const normalizedOption = normalizeMatchText(rawOption)
  const exactValueMatch = normalizedOption.match(/^(\d+(?:\.\d+)?)$/)
  if (exactValueMatch) {
    const optionValue = Number(exactValueMatch[1])
    if (Number.isFinite(optionValue)) {
      return optionValue === profileNumber
    }
  }

  const explicitRangeMatch = rawOption.match(
    /(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)/i
  )
  if (explicitRangeMatch) {
    const minValue = Number(explicitRangeMatch[1])
    const maxValue = Number(explicitRangeMatch[2])
    if (Number.isFinite(minValue) && Number.isFinite(maxValue)) {
      return profileNumber >= Math.min(minValue, maxValue) &&
        profileNumber <= Math.max(minValue, maxValue)
    }
  }

  const normalizedRangeMatch = normalizedOption.match(
    /\b(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\b/
  )
  if (normalizedRangeMatch) {
    const minValue = Number(normalizedRangeMatch[1])
    const maxValue = Number(normalizedRangeMatch[2])
    if (Number.isFinite(minValue) && Number.isFinite(maxValue)) {
      return profileNumber >= Math.min(minValue, maxValue) &&
        profileNumber <= Math.max(minValue, maxValue)
    }
  }

  const plusMatch = rawOption.match(/(\d+(?:\.\d+)?)\s*\+/)
  if (plusMatch) {
    const minValue = Number(plusMatch[1])
    if (Number.isFinite(minValue)) {
      return profileNumber >= minValue
    }
  }

  const lessThanMatch = rawOption.match(
    /(?:less than|under|below|upto|up to|<)\s*(\d+(?:\.\d+)?)/i
  )
  if (lessThanMatch) {
    const maxValue = Number(lessThanMatch[1])
    if (Number.isFinite(maxValue)) {
      return profileNumber < maxValue
    }
  }

  const moreThanMatch = rawOption.match(
    /(?:more than|above|at least|minimum|>=)\s*(\d+(?:\.\d+)?)/i
  )
  if (moreThanMatch) {
    const minValue = Number(moreThanMatch[1])
    if (Number.isFinite(minValue)) {
      return profileNumber >= minValue
    }
  }

  if (/(?:or more|and above|plus)/i.test(rawOption)) {
    const numbers = extractNumericValues(rawOption)
    if (numbers.length > 0) {
      return profileNumber >= numbers[0]
    }
  }

  return false
}

export const toProfileStringValues = (value: AutofillValue | undefined): string[] => {
  if (typeof value === "string") {
    const raw = value.trim()
    if (!raw) {
      return []
    }

    const parts = raw
      .split(/[\n,;|]+/)
      .map((item) => item.trim())
      .filter(Boolean)

    return Array.from(new Set([raw, ...parts]))
  }

  if (Array.isArray(value)) {
    const parts = value.map((item) => item.trim()).filter(Boolean)
    return Array.from(new Set(parts))
  }

  if (typeof value === "boolean") {
    return value ? ["true", "yes", "1"] : ["false", "no", "0"]
  }

  return []
}

export const setNativeValue = (
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

export const setNativeChecked = (element: HTMLInputElement, nextChecked: boolean) => {
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

export const setNativeFiles = (element: HTMLInputElement, files: File[]): boolean => {
  if (typeof DataTransfer === "undefined") {
    return false
  }

  const dataTransfer = new DataTransfer()
  for (const file of files) {
    dataTransfer.items.add(file)
  }

  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "files"
  )

  if (!descriptor?.set) {
    return false
  }

  descriptor.set.call(element, dataTransfer.files)
  return true
}

export const dataUrlToFile = (dataUrl: string, fileName: string): File | undefined => {
  const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/.exec(dataUrl)
  if (!match) {
    return undefined
  }

  const mimeType = match[1] ?? "application/octet-stream"
  const payload = match[2] ?? ""
  const isBase64 = dataUrl.includes(";base64,")

  if (isBase64) {
    let normalizedPayload = payload.trim()

    try {
      normalizedPayload = decodeURIComponent(normalizedPayload)
    } catch {
      // Keep original payload if it is already plain base64.
    }

    normalizedPayload = normalizedPayload
      .replace(/[\r\n\s]/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/")

    const remainder = normalizedPayload.length % 4
    if (remainder > 0) {
      normalizedPayload = normalizedPayload.padEnd(
        normalizedPayload.length + (4 - remainder),
        "="
      )
    }

    const binaryString = atob(normalizedPayload)
    const bytes = new Uint8Array(binaryString.length)

    for (let index = 0; index < binaryString.length; index += 1) {
      bytes[index] = binaryString.charCodeAt(index)
    }

    return new File([bytes], fileName, { type: mimeType })
  }

  const decoded = decodeURIComponent(payload)
  return new File([decoded], fileName, { type: mimeType })
}

export const getAssociatedLabelText = (element: HTMLElement): string => {
  const rawId = element.getAttribute("id")?.trim()
  if (!rawId) {
    return ""
  }

  const safeId = window.CSS?.escape ? window.CSS.escape(rawId) : rawId
  const label = element.ownerDocument.querySelector(`label[for="${safeId}"]`)
  return label?.textContent?.trim() ?? ""
}

export const getNearestUploadContainerText = (element: HTMLElement): string => {
  const container = element.closest(
    "label, .field, .form-group, .application-field, [class*='upload'], [data-type]"
  )

  if (!(container instanceof HTMLElement)) {
    return ""
  }

  return (container.textContent ?? "").slice(0, 320)
}

export const delay = (durationMs: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, durationMs)
  })

export const toStringValue = (
  value: AutofillValue | undefined
): string | undefined => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value
  }

  if (Array.isArray(value)) {
    const parts = value.map((item) => item.trim()).filter(Boolean)
    if (parts.length > 0) {
      return parts.join(", ")
    }
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }

  return undefined
}

export const NUMBER_PATTERN = /^[+-]?\d+(?:\.\d+)?$/

export const toNumberInputValue = (
  value: AutofillValue | undefined
): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed.length > 0 && NUMBER_PATTERN.test(trimmed)) {
      return trimmed
    }
  }

  const profileValues = toProfileStringValues(value)

  for (const profileValue of profileValues) {
    const trimmed = profileValue.trim()
    if (!trimmed) {
      continue
    }

    if (NUMBER_PATTERN.test(trimmed)) {
      return trimmed
    }

    const extractedNumbers = extractNumericValues(trimmed)
    if (extractedNumbers.length > 0) {
      return String(extractedNumbers[0])
    }
  }

  return undefined
}

export const toBooleanValue = (
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

export const toLocationPart = (
  value: AutofillValue | undefined
): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  if (Array.isArray(value)) {
    const joined = value.map((item) => item.trim()).filter(Boolean).join(", ")
    return joined.length > 0 ? joined : undefined
  }

  return undefined
}

type ExperienceComponentHint = "years" | "months"

const EXPERIENCE_YEARS_HINTS = [
  "experience years",
  "years of experience",
  "work experience years",
  "workexperience years",
  "experience in years",
  "enter just years",
  "just years",
  "years eg"
]

const EXPERIENCE_MONTHS_HINTS = [
  "experience months",
  "work experience months",
  "workexperience months",
  "months of experience"
]

const DATE_OF_BIRTH_HINTS = [
  "date of birth",
  "birth date",
  "dob"
]

const PROFESSION_PROMPT_TOKENS = [
  "profession",
  "functional area",
  "job function",
  "domain"
]

const NOTICE_PERIOD_DAY_HINTS = [
  "number of days",
  "notice period days",
  "days"
]

export const hasPromptToken = (
  result: Layer1Result,
  tokens: readonly string[]
): boolean => {
  const signalValues = Object.values(result.signals).flatMap((values) => values)

  for (const rawSignalValue of signalValues) {
    const normalized = normalizeMatchText(rawSignalValue)
    if (!normalized) {
      continue
    }

    for (const token of tokens) {
      if (containsWholeToken(normalized, normalizeMatchText(token))) {
        return true
      }
    }
  }

  return false
}

export const getExperienceComponentHint = (
  result: Layer1Result
): ExperienceComponentHint | null => {
  if (hasPromptToken(result, EXPERIENCE_MONTHS_HINTS)) {
    return "months"
  }

  if (hasPromptToken(result, EXPERIENCE_YEARS_HINTS)) {
    return "years"
  }

  return null
}

const pad2 = (value: number): string => String(value).padStart(2, "0")
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

export const parseDateFromRawValue = (rawValue: string): Date | null => {
  const trimmed = rawValue.trim()
  if (!trimmed) {
    return null
  }

  const direct = new Date(trimmed)
  if (!Number.isNaN(direct.getTime())) {
    return direct
  }

  const normalized = trimmed
    .toLowerCase()
    .replace(/(\d+)(st|nd|rd|th)/g, "$1")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const normalizedDate = new Date(normalized)
  if (!Number.isNaN(normalizedDate.getTime())) {
    return normalizedDate
  }

  return null
}

export const toDateInputCandidateValues = (value: AutofillValue | undefined): string[] => {
  const rawValues = toProfileStringValues(value)
  if (rawValues.length === 0) {
    return []
  }

  const candidates = new Set<string>()

  for (const rawValue of rawValues) {
    const parsedDate = parseDateFromRawValue(rawValue)
    if (!parsedDate) {
      const trimmed = rawValue.trim()
      if (trimmed) {
        candidates.add(trimmed)
      }
      continue
    }

    const day = pad2(parsedDate.getDate())
    const month = pad2(parsedDate.getMonth() + 1)
    const year = parsedDate.getFullYear()

    candidates.add(`${day}/${month}/${year}`)
    candidates.add(`${day}-${month}-${year}`)
    candidates.add(`${month}/${day}/${year}`)
    candidates.add(`${year}-${month}-${day}`)
  }

  return Array.from(candidates)
}

export const toNoticePeriodDaysValue = (
  value: AutofillValue | undefined,
  referenceDate: Date = new Date()
): string | undefined => {
  const rawValues = toProfileStringValues(value)
  if (rawValues.length === 0) {
    return undefined
  }

  for (const rawValue of rawValues) {
    const trimmed = rawValue.trim()
    if (!trimmed) {
      continue
    }

    if (NUMBER_PATTERN.test(trimmed)) {
      return trimmed
    }

    if (/^(immediate|immediately|asap|available now)$/i.test(trimmed)) {
      return "0"
    }

    const parsedDate = parseDateFromRawValue(trimmed)
    if (!parsedDate) {
      continue
    }

    const startOfToday = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate()
    )
    const startOfTarget = new Date(
      parsedDate.getFullYear(),
      parsedDate.getMonth(),
      parsedDate.getDate()
    )

    const diffDays = Math.ceil(
      (startOfTarget.getTime() - startOfToday.getTime()) / MILLISECONDS_PER_DAY
    )

    if (Number.isFinite(diffDays)) {
      return String(Math.max(0, diffDays))
    }
  }

  return undefined
}

export const deriveProfessionCategoryValues = (
  profile: AutofillProfile
): string[] => {
  const source = [
    toStringValue(profile[FieldType.JobTitle]) ?? "",
    toStringValue(profile[FieldType.Skills]) ?? "",
    toStringValue(profile[FieldType.TechStack]) ?? ""
  ]
    .join(" ")
    .toLowerCase()

  const categories: string[] = []

  const pushUnique = (value: string) => {
    if (!categories.includes(value)) {
      categories.push(value)
    }
  }

  if (
    /(developer|software|full stack|frontend|backend|engineer|react|node|javascript|typescript|programming|tech)/i.test(
      source
    )
  ) {
    pushUnique("Information Technology")
    pushUnique("Engineering")
  }

  if (/(product|roadmap|feature)/i.test(source)) {
    pushUnique("Product Management")
  }

  if (/(marketing|growth|seo|campaign)/i.test(source)) {
    pushUnique("Marketing")
  }

  if (/(sales|account executive|business development|lead generation)/i.test(source)) {
    pushUnique("Sales")
    pushUnique("Business Development")
  }

  if (/(hr|human resources|recruit|talent)/i.test(source)) {
    pushUnique("Human Resources")
  }

  return categories
}

export const hasCityCountryPrompt = (result: Layer1Result): boolean => {
  const signalValues = Object.values(result.signals).flatMap((values) => values)

  for (const signalValue of signalValues) {
    const normalized = normalizeMatchText(signalValue)
    if (!normalized) {
      continue
    }

    const hasCity = containsWholeToken(normalized, "city")
    const hasCountry =
      containsWholeToken(normalized, "country") ||
      containsWholeToken(normalized, "nation")

    if (hasCity && hasCountry) {
      return true
    }
  }

  return false
}

export const resolveProfileValueForField = (
  result: Layer1Result,
  profile: AutofillProfile
): AutofillValue | undefined => {
  if (hasPromptToken(result, PROFESSION_PROMPT_TOKENS)) {
    const categories = deriveProfessionCategoryValues(profile)
    if (categories.length > 0) {
      return categories
    }
  }

  if (
    result.fieldType === FieldType.TotalExperience ||
    result.fieldType === FieldType.RelevantExperience
  ) {
    const hint = getExperienceComponentHint(result)
    const parsedDuration =
      parseExperienceDuration(profile[FieldType.TotalExperience]) ??
      parseExperienceDuration(profile[result.fieldType])

    if (hint && parsedDuration) {
      return hint === "years"
        ? String(parsedDuration.years)
        : String(parsedDuration.months)
    }
  }

  if (
    result.fieldType === FieldType.DateOfBirth &&
    hasPromptToken(result, DATE_OF_BIRTH_HINTS)
  ) {
    const fromProfile = profile[FieldType.DateOfBirth]
    if (fromProfile) {
      return fromProfile
    }
  }

  if (result.fieldType === FieldType.NoticePeriod) {
    const noticeValue = profile[FieldType.NoticePeriod]
    if (hasPromptToken(result, NOTICE_PERIOD_DAY_HINTS)) {
      const normalizedNoticeDays = toNoticePeriodDaysValue(noticeValue)
      if (normalizedNoticeDays) {
        return normalizedNoticeDays
      }
    }
  }

  if (
    (result.fieldType === FieldType.City || result.fieldType === FieldType.Country) &&
    hasCityCountryPrompt(result)
  ) {
    const city = toLocationPart(profile[FieldType.City])
    const country = toLocationPart(profile[FieldType.Country])

    if (city && country) {
      return `${city}, ${country}`
    }

    return city ?? country
  }

  return profile[result.fieldType]
}

export const emitKeyboardAction = (
  element: HTMLElement,
  key: string,
  code: string
): void => {
  element.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      code,
      bubbles: true
    })
  )
  element.dispatchEvent(
    new KeyboardEvent("keyup", {
      key,
      code,
      bubbles: true
    })
  )
}

export const scoreOptionTextMatch = (
  normalizedOptionTexts: string[],
  rawOptionTexts: string[],
  normalizedProfileValues: string[],
  profileNumber: number | null
): number => {
  let score = 0

  for (const optionText of normalizedOptionTexts) {
    for (const profileItem of normalizedProfileValues) {
      if (optionText === profileItem) {
        score = Math.max(score, 3)
        continue
      }

      if (optionText.length >= 3 && containsWholeToken(profileItem, optionText)) {
        score = Math.max(score, 2)
        continue
      }

      if (profileItem.length >= 3 && containsWholeToken(optionText, profileItem)) {
        score = Math.max(score, 2)
      }
    }
  }

  if (score === 0 && profileNumber !== null) {
    const numericMatch = rawOptionTexts.some((text) =>
      matchesNumericRange(text, profileNumber)
    )
    if (numericMatch) {
      score = Math.max(score, 2.5)
    }
  }

  return score
}

export const PLACEHOLDER_OPTION_PATTERNS = [
  /^select\b/,
  /^choose\b/,
  /^please select\b/,
  /^please choose\b/,
  /^--+$/
]

export const isPlaceholderOptionText = (normalizedText: string): boolean =>
  PLACEHOLDER_OPTION_PATTERNS.some((pattern) => pattern.test(normalizedText))

export const getComboboxOptionTexts = (option: HTMLElement): string[] => {
  const rawValues = [
    option.textContent ?? "",
    option.getAttribute("aria-label") ?? "",
    option.getAttribute("data-value") ?? "",
    option.getAttribute("title") ?? ""
  ]

  return Array.from(new Set(rawValues.map((value) => value.trim()).filter(Boolean)))
}

export const dispatchComboboxOptionPointerEvents = (option: HTMLElement): void => {
  if (typeof PointerEvent !== "undefined") {
    option.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true })
    )
  }

  option.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, cancelable: true, buttons: 1 })
  )
  option.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }))

  if (typeof PointerEvent !== "undefined") {
    option.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, cancelable: true })
    )
  }
}
