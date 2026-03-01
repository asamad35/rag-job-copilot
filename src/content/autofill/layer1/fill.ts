import bundledResumeDataUrl from "data-url:../../../../Samad_Resume.pdf"

import { isElementVisible } from "~src/content/autofill/dom-utils"
import {
  AutofillProfile,
  AutofillValue,
  ControlKind,
  FieldType,
  FillActionResult,
  Layer1Result,
  LayerStatus,
  SignalType
} from "~src/content/autofill/types"

const DEFAULT_RESUME_FILE_NAME = "Samad_Resume.pdf"
const ASHBY_AUTOFILL_PANE_FILE_SELECTOR =
  "[class*='ashby-application-form-autofill'] input[type='file']"
const RESUME_DROPZONE_SELECTOR = ".dropzone, [id*='dropzone'], [data-category]"
const RESUME_DROPZONE_HINTS = ["resume", "cv", "curriculum vitae"]
const RESUME_ACCEPT_HINTS = ["pdf", "doc", "docx", "rtf", "text/plain"]
const GOOGLE_FORMS_RESUME_TRIGGER_SELECTOR =
  "[role='button'][aria-labelledby], [role='button'][aria-label]"
const GOOGLE_FORMS_RESUME_INPUT_WAIT_MS = 1600
const GOOGLE_PICKER_BROWSE_SELECTOR =
  "button[aria-label*='Browse' i], [role='button'][aria-label*='Browse' i]"
const GOOGLE_PICKER_HINTS = [
  "insert file",
  "upload 1 supported file",
  "drag a file here",
  "my drive",
  "recent",
  "browse"
]
const COMBOBOX_OPTION_SELECTOR =
  "[role='option'], [aria-selected][id*='option'], [class*='select__option']"
const BUTTON_COMBOBOX_OPTION_SELECTOR =
  "[role='option'], [cmdk-item], [data-radix-collection-item], [class*='select__option'], [data-value]"
const BUTTON_COMBOBOX_INPUT_SELECTOR =
  "input[cmdk-input], input[role='combobox'], input[type='text'], input[type='search']"
const COMBOBOX_OPEN_WAIT_MS = 520
const COMBOBOX_POLL_INTERVAL_MS = 40
const AGGRESSIVE_LABEL_FILL_MIN_CONFIDENCE = 0.7
const STRONG_LABEL_SIGNALS: readonly SignalType[] = [
  SignalType.LabelFor,
  SignalType.LabelWrap,
  SignalType.AriaLabelledBy
]

let cachedBundledResumeFile: File | null | undefined

interface DropzoneLikeElement extends HTMLElement {
  dropzone?: {
    hiddenFileInput?: HTMLInputElement
  }
}

const dispatchFieldEvents = (element: Element) => {
  element.dispatchEvent(new Event("input", { bubbles: true }))
  element.dispatchEvent(new Event("change", { bubbles: true }))
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const normalizeMatchText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")

const containsWholeToken = (normalizedText: string, token: string): boolean => {
  const pattern = new RegExp(`(^|\\s)${escapeRegExp(token)}(\\s|$)`)
  return pattern.test(normalizedText)
}

const extractNumericValues = (value: string): number[] => {
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

const parseExperienceDuration = (
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

const pickRepresentativeNumber = (normalizedValues: string[]): number | null => {
  for (const value of normalizedValues) {
    const numbers = extractNumericValues(value)
    if (numbers.length > 0) {
      return numbers[0]
    }
  }

  return null
}

const matchesNumericRange = (rawOption: string, profileNumber: number): boolean => {
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

const toProfileStringValues = (value: AutofillValue | undefined): string[] => {
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

const dataUrlToFile = (dataUrl: string, fileName: string): File | undefined => {
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

const getBundledResumeFile = (): File | undefined => {
  if (cachedBundledResumeFile !== undefined) {
    return cachedBundledResumeFile ?? undefined
  }

  cachedBundledResumeFile =
    dataUrlToFile(bundledResumeDataUrl, DEFAULT_RESUME_FILE_NAME) ?? null

  return cachedBundledResumeFile ?? undefined
}

const setNativeValue = (
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

const setNativeChecked = (element: HTMLInputElement, nextChecked: boolean) => {
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

const setNativeFiles = (element: HTMLInputElement, files: File[]): boolean => {
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

const assignResumeToFileInput = (
  input: HTMLInputElement,
  resumeFile: File
): boolean => {
  if (input.disabled) {
    return false
  }

  if (input.files && input.files.length > 0) {
    return true
  }

  const assigned = setNativeFiles(input, [resumeFile])
  if (!assigned) {
    return false
  }

  dispatchFieldEvents(input)
  return true
}

const getAssociatedLabelText = (element: HTMLElement): string => {
  const rawId = element.getAttribute("id")?.trim()
  if (!rawId) {
    return ""
  }

  const safeId = window.CSS?.escape ? window.CSS.escape(rawId) : rawId
  const label = element.ownerDocument.querySelector(`label[for="${safeId}"]`)
  return label?.textContent?.trim() ?? ""
}

const hasResumeHint = (rawText: string): boolean => {
  const normalized = normalizeMatchText(rawText)
  if (!normalized) {
    return false
  }

  return RESUME_DROPZONE_HINTS.some((hint) =>
    containsWholeToken(normalized, normalizeMatchText(hint))
  )
}

const isLikelyResumeDropzone = (element: HTMLElement): boolean => {
  const context = [
    element.id,
    element.className,
    element.getAttribute("data-category") ?? "",
    element.getAttribute("name") ?? "",
    element.getAttribute("aria-label") ?? "",
    getAssociatedLabelText(element),
    (element.textContent ?? "").slice(0, 240)
  ]
    .filter(Boolean)
    .join(" ")

  return hasResumeHint(context)
}

const findResumeDropzoneFileInput = (
  dropzoneElement: DropzoneLikeElement
): HTMLInputElement | null => {
  const fromInstance = dropzoneElement.dropzone?.hiddenFileInput
  if (fromInstance instanceof HTMLInputElement) {
    return fromInstance
  }

  const inDropzone = dropzoneElement.querySelector("input[type='file']")
  if (inDropzone instanceof HTMLInputElement) {
    return inDropzone
  }

  const formRoot = dropzoneElement.closest("form") ?? document
  const scopedCandidates = Array.from(
    formRoot.querySelectorAll("input[type='file']")
  ) as HTMLInputElement[]

  const dropzoneHiddenInput = scopedCandidates.find((input) =>
    input.className.toLowerCase().includes("dz-hidden-input")
  )
  if (dropzoneHiddenInput) {
    return dropzoneHiddenInput
  }

  const resumeNamedInput = scopedCandidates.find((input) =>
    hasResumeHint(
      `${input.name} ${input.id} ${input.className} ${input.accept} ${
        input.getAttribute("aria-label") ?? ""
      }`
    )
  )

  if (resumeNamedInput) {
    return resumeNamedInput
  }

  const globalDropzoneHiddenInput = Array.from(
    document.querySelectorAll("input[type='file']")
  ).find(
    (input): input is HTMLInputElement =>
      input instanceof HTMLInputElement &&
      input.className.toLowerCase().includes("dz-hidden-input")
  )

  if (globalDropzoneHiddenInput) {
    return globalDropzoneHiddenInput
  }

  return null
}

const getNearestUploadContainerText = (element: HTMLElement): string => {
  const container = element.closest(
    "label, .field, .form-group, .application-field, [class*='upload'], [data-type]"
  )

  if (!(container instanceof HTMLElement)) {
    return ""
  }

  return (container.textContent ?? "").slice(0, 320)
}

const isLikelyResumeFileInput = (input: HTMLInputElement): boolean => {
  const context = [
    input.name,
    input.id,
    input.className,
    input.accept,
    input.getAttribute("aria-label") ?? "",
    input.getAttribute("data-category") ?? "",
    input.getAttribute("data-type") ?? "",
    getAssociatedLabelText(input),
    input.closest("label")?.textContent ?? "",
    getNearestUploadContainerText(input)
  ]
    .filter(Boolean)
    .join(" ")

  return hasResumeHint(context)
}

const isLikelyResumeAcceptType = (acceptValue: string): boolean => {
  const normalizedAccept = acceptValue.toLowerCase()
  if (!normalizedAccept) {
    return false
  }

  return RESUME_ACCEPT_HINTS.some((hint) => normalizedAccept.includes(hint))
}

const getCandidateResumeFileInputs = (): HTMLInputElement[] =>
  getAllFileInputs().filter(
    (element): element is HTMLInputElement => {
      if (!(element instanceof HTMLInputElement)) {
        return false
      }

      if (element.disabled) {
        return false
      }

      return isLikelyResumeFileInput(element) || isLikelyResumeAcceptType(element.accept)
    }
  )

const collectSearchRoots = (): Array<Document | ShadowRoot> => {
  const roots: Array<Document | ShadowRoot> = [document]
  const seenShadowRoots = new Set<ShadowRoot>()

  for (let index = 0; index < roots.length; index += 1) {
    const root = roots[index]
    const elements = Array.from(root.querySelectorAll("*"))

    for (const element of elements) {
      if (!(element instanceof HTMLElement)) {
        continue
      }

      const shadowRoot = element.shadowRoot
      if (!shadowRoot || seenShadowRoots.has(shadowRoot)) {
        continue
      }

      seenShadowRoots.add(shadowRoot)
      roots.push(shadowRoot)
    }
  }

  return roots
}

const getAllFileInputs = (): HTMLInputElement[] =>
  (() => {
    const seen = new Set<HTMLInputElement>()
    const collected: HTMLInputElement[] = []

    for (const root of collectSearchRoots()) {
      const inputs = Array.from(root.querySelectorAll("input[type='file']")).filter(
        (element): element is HTMLInputElement => element instanceof HTMLInputElement
      )

      for (const input of inputs) {
        if (seen.has(input)) {
          continue
        }

        seen.add(input)
        collected.push(input)
      }
    }

    return collected
  })()

const getLikelyResumeFileInput = (
  exclude?: ReadonlySet<HTMLInputElement>
): HTMLInputElement | null => {
  const allCandidates = getCandidateResumeFileInputs()

  const filtered = exclude
    ? allCandidates.filter((input) => !exclude.has(input))
    : allCandidates

  if (filtered.length === 0) {
    return null
  }

  const emptyInput = filtered.find((input) => !input.files || input.files.length === 0)
  return emptyInput ?? filtered[0]
}

const getAnyAssignableFileInput = (
  exclude?: ReadonlySet<HTMLInputElement>
): HTMLInputElement | null => {
  const allInputs = getAllFileInputs().filter((input) => {
    if (input.disabled) {
      return false
    }

    if (exclude?.has(input)) {
      return false
    }

    return true
  })

  if (allInputs.length === 0) {
    return null
  }

  const emptyInput = allInputs.find((input) => !input.files || input.files.length === 0)
  return emptyInput ?? allInputs[0]
}

const getTextFromIdReferences = (
  owner: Element,
  rawIds: string | null
): string => {
  if (!rawIds) {
    return ""
  }

  const ids = rawIds
    .split(/\s+/)
    .map((id) => id.trim())
    .filter(Boolean)

  if (ids.length === 0) {
    return ""
  }

  const values = ids
    .map((id) => owner.ownerDocument.getElementById(id)?.textContent?.trim() ?? "")
    .filter(Boolean)

  return values.join(" ")
}

const isGoogleDocsHost = (): boolean =>
  /(^|\.)docs\.google\.com$/i.test(window.location.hostname)

const isGoogleFormsPage = (): boolean =>
  isGoogleDocsHost() &&
  /\/forms\//i.test(window.location.pathname)

const isLikelyGooglePickerDialog = (): boolean => {
  if (!isGoogleDocsHost()) {
    return false
  }

  const bodyText = normalizeMatchText((document.body?.textContent ?? "").slice(0, 4000))
  const hasHint = GOOGLE_PICKER_HINTS.some((hint) =>
    containsWholeToken(bodyText, normalizeMatchText(hint))
  )

  if (hasHint) {
    return true
  }

  return (
    document.querySelector(GOOGLE_PICKER_BROWSE_SELECTOR) instanceof HTMLElement
  )
}

const isLikelyGoogleFormsResumeTrigger = (element: HTMLElement): boolean => {
  const context = [
    element.textContent ?? "",
    element.getAttribute("aria-label") ?? "",
    getTextFromIdReferences(element, element.getAttribute("aria-labelledby")),
    getTextFromIdReferences(element, element.getAttribute("aria-describedby")),
    element.closest("[data-params]")?.getAttribute("data-params") ?? "",
    getNearestUploadContainerText(element)
  ]
    .filter(Boolean)
    .join(" ")

  const normalized = normalizeMatchText(context)
  const hasUploadAction =
    containsWholeToken(normalized, "file") ||
    containsWholeToken(normalized, "upload") ||
    containsWholeToken(normalized, "add")

  return hasUploadAction && hasResumeHint(context)
}

const waitForResumeFileInputAfterTrigger = (
  beforeInputs: ReadonlySet<HTMLInputElement>,
  timeoutMs: number,
  options: { allowAnyFileInput?: boolean } = {}
): Promise<HTMLInputElement | null> =>
  new Promise((resolve) => {
    const immediate = options.allowAnyFileInput
      ? getAnyAssignableFileInput(beforeInputs)
      : getLikelyResumeFileInput(beforeInputs)
    if (immediate) {
      resolve(immediate)
      return
    }

    const root = document.documentElement
    if (!root) {
      resolve(null)
      return
    }

    let timeoutId = 0
    const observer = new MutationObserver(() => {
      const next = options.allowAnyFileInput
        ? getAnyAssignableFileInput(beforeInputs)
        : getLikelyResumeFileInput(beforeInputs)
      if (!next) {
        return
      }

      observer.disconnect()
      window.clearTimeout(timeoutId)
      resolve(next)
    })

    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden"]
    })

    timeoutId = window.setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeoutMs)
  })

const isInputWithBooleanValue = (
  element: Element
): element is HTMLInputElement =>
  element instanceof HTMLInputElement &&
  (element.type.toLowerCase() === "checkbox" ||
    element.type.toLowerCase() === "radio")

const isComboboxInput = (element: Element): element is HTMLInputElement => {
  if (!(element instanceof HTMLInputElement)) {
    return false
  }

  const role = element.getAttribute("role")?.toLowerCase()
  if (role === "combobox" || role === "listbox") {
    return true
  }

  const hasPopup = element.getAttribute("aria-haspopup")?.toLowerCase()
  return hasPopup === "true" || hasPopup === "listbox"
}

const isButtonCombobox = (element: Element): element is HTMLButtonElement => {
  if (!(element instanceof HTMLButtonElement)) {
    return false
  }

  const role = element.getAttribute("role")?.toLowerCase()
  if (role === "combobox" || role === "listbox") {
    return true
  }

  const hasPopup = element.getAttribute("aria-haspopup")?.toLowerCase()
  return hasPopup === "true" || hasPopup === "listbox" || hasPopup === "dialog"
}

const isInternationalPhoneCountrySelectorButton = (
  element: Element
): element is HTMLButtonElement =>
  element instanceof HTMLButtonElement &&
  element.classList.contains("react-international-phone-country-selector-button")

const COUNTRY_CODE_OPTION_PATTERN = /^\+\d{1,4}$/

const isLikelyCountryCodeSelect = (select: HTMLSelectElement): boolean => {
  const options = Array.from(select.options)
  if (options.length < 3) {
    return false
  }

  let countryCodeCount = 0
  for (const option of options) {
    const value = option.value.trim()
    const text = (option.textContent ?? "").trim()

    if (
      COUNTRY_CODE_OPTION_PATTERN.test(value) ||
      COUNTRY_CODE_OPTION_PATTERN.test(text) ||
      /^\+\d{1,4}\s/.test(text)
    ) {
      countryCodeCount += 1
    }

    if (countryCodeCount >= 3) {
      return true
    }
  }

  return false
}

const findNearbyCountryCodeSelect = (
  phoneInput: HTMLInputElement
): HTMLSelectElement | null => {
  const wrapper =
    phoneInput.closest(
      ".field, .form-group, .form-field, [class*='phone'], [class*='tel'], [class*='input-group']"
    ) ??
    phoneInput.parentElement?.parentElement ??
    phoneInput.parentElement

  if (!wrapper) {
    return null
  }

  const selects = Array.from(wrapper.querySelectorAll("select")).filter(
    (el): el is HTMLSelectElement => el instanceof HTMLSelectElement
  )

  return selects.find(isLikelyCountryCodeSelect) ?? null
}

const stripCountryCodePrefix = (
  fullPhone: string,
  countryCode: string
): string => {
  const normalizedCode = countryCode.replace(/[^+\d]/g, "")
  const normalizedPhone = fullPhone.replace(/[^+\d]/g, "")

  if (normalizedPhone.startsWith(normalizedCode)) {
    return normalizedPhone.slice(normalizedCode.length)
  }

  // If the phone doesn't start with +, it might already be a local number
  if (!normalizedPhone.startsWith("+")) {
    return normalizedPhone
  }

  return normalizedPhone
}

const getSelectedCountryCode = (select: HTMLSelectElement): string => {
  const selected = select.options[select.selectedIndex]
  if (!selected) {
    return ""
  }

  const value = selected.value.trim()
  if (COUNTRY_CODE_OPTION_PATTERN.test(value)) {
    return value
  }

  const text = (selected.textContent ?? "").trim()
  const codeMatch = text.match(/^(\+\d{1,4})/)
  return codeMatch ? codeMatch[1] : ""
}

const applyCountryCodeToSelect = (
  select: HTMLSelectElement,
  fullPhone: string
): string | null => {
  const normalizedPhone = fullPhone.replace(/[^+\d]/g, "")
  if (!normalizedPhone.startsWith("+")) {
    return null
  }

  // Try longest matching country code first (e.g. +91 before +9)
  let bestMatch = ""
  let bestOption: HTMLOptionElement | null = null

  for (const option of Array.from(select.options)) {
    const value = option.value.trim()
    const text = (option.textContent ?? "").trim()
    const codeMatch = text.match(/^(\+\d{1,4})/)
    const candidateCode =
      COUNTRY_CODE_OPTION_PATTERN.test(value)
        ? value
        : codeMatch
          ? codeMatch[1]
          : ""

    if (
      candidateCode &&
      normalizedPhone.startsWith(candidateCode) &&
      candidateCode.length > bestMatch.length
    ) {
      bestMatch = candidateCode
      bestOption = option
    }
  }

  if (bestOption && bestMatch) {
    setNativeValue(select, bestOption.value)
    dispatchFieldEvents(select)
    return bestMatch
  }

  return null
}

const delay = (durationMs: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, durationMs)
  })

const toStringValue = (
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

const NUMBER_PATTERN = /^[+-]?\d+(?:\.\d+)?$/

const toNumberInputValue = (
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

const toBooleanValue = (
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

const toLocationPart = (
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

const hasPromptToken = (
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

const getExperienceComponentHint = (
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

const parseDateFromRawValue = (rawValue: string): Date | null => {
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

const toDateInputCandidateValues = (value: AutofillValue | undefined): string[] => {
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

const toNoticePeriodDaysValue = (
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

const deriveProfessionCategoryValues = (
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

const hasCityCountryPrompt = (result: Layer1Result): boolean => {
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

const resolveProfileValueForField = (
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

const getComparableOptionTexts = (element: HTMLInputElement): string[] => {
  const values: string[] = []
  const pushIfPresent = (rawValue: string | null | undefined) => {
    if (!rawValue) {
      return
    }

    const trimmed = rawValue.trim()
    if (!trimmed) {
      return
    }

    values.push(trimmed)
  }

  pushIfPresent(element.value)
  pushIfPresent(element.getAttribute("aria-label"))
  pushIfPresent(element.getAttribute("data-label"))
  pushIfPresent(element.getAttribute("title"))

  if (element.labels) {
    for (const label of Array.from(element.labels)) {
      pushIfPresent(label.textContent)
    }
  }

  pushIfPresent(element.closest("label")?.textContent)

  return Array.from(new Set(values))
}

const isOptionMatchedByProfile = (
  element: HTMLInputElement,
  profileValue: AutofillValue | undefined
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

  for (const optionValue of normalizedOptionValues) {
    for (const profileItem of profileValues) {
      if (optionValue === profileItem) {
        return true
      }

      if (optionValue.length >= 3 && containsWholeToken(profileItem, optionValue)) {
        return true
      }

      if (profileItem.length >= 3 && containsWholeToken(optionValue, profileItem)) {
        return true
      }
    }
  }

  const profileNumber = pickRepresentativeNumber(profileValues)
  if (profileNumber === null) {
    return false
  }

  for (const optionValue of optionValues) {
    if (matchesNumericRange(optionValue, profileNumber)) {
      return true
    }
  }

  return false
}

const getSelectOptionTexts = (option: HTMLOptionElement): string[] => {
  const rawValues = [option.value, option.label, option.text]
  return rawValues.map((item) => item.trim()).filter(Boolean)
}

const PLACEHOLDER_OPTION_PATTERNS = [
  /^select\b/,
  /^choose\b/,
  /^please select\b/,
  /^please choose\b/,
  /^--+$/
]

const isPlaceholderSelectOption = (
  option: HTMLOptionElement,
  normalizedOptionTexts: string[]
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
    PLACEHOLDER_OPTION_PATTERNS.some((pattern) => pattern.test(text))
  )
}

const getMatchingSelectOptionValues = (
  element: HTMLSelectElement,
  profileValue: AutofillValue | undefined
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

    if (isPlaceholderSelectOption(option, normalizedOptionTexts)) {
      continue
    }

    let matched = false

    for (const optionText of normalizedOptionTexts) {
      for (const profileItem of normalizedProfileValues) {
        if (optionText === profileItem) {
          matched = true
          break
        }

        if (optionText.length >= 3 && containsWholeToken(profileItem, optionText)) {
          matched = true
          break
        }

        if (profileItem.length >= 3 && containsWholeToken(optionText, profileItem)) {
          matched = true
          break
        }
      }

      if (matched) {
        break
      }
    }

    if (!matched && profileNumber !== null) {
      matched = optionTexts.some((text) => matchesNumericRange(text, profileNumber))
    }

    if (matched) {
      matchedValues.add(option.value)
    }
  }

  return Array.from(matchedValues)
}

const applyToSelect = (
  element: HTMLSelectElement,
  profileValue: AutofillValue | undefined
): boolean => {
  const matchedValues = getMatchingSelectOptionValues(element, profileValue)

  if (matchedValues.length === 0) {
    return false
  }

  if (element.multiple) {
    const matchedValueSet = new Set(matchedValues)
    for (const option of Array.from(element.options)) {
      option.selected = matchedValueSet.has(option.value)
    }

    return Array.from(element.selectedOptions).length > 0
  }

  const selectedValue = matchedValues[0]
  setNativeValue(element, selectedValue)

  return element.value === selectedValue
}

const applyToCustomElement = (element: HTMLElement, value: string): boolean => {
  if (element.isContentEditable) {
    element.textContent = value
    dispatchFieldEvents(element)
    return true
  }

  if ("value" in element) {
    const valueCarrier = element as HTMLElement & { value: string }
    valueCarrier.value = value
    dispatchFieldEvents(element)
    return true
  }

  return false
}

const emitKeyboardAction = (
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

const dispatchComboboxOptionPointerEvents = (option: HTMLElement): void => {
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

const isPlaceholderOptionText = (normalizedText: string): boolean =>
  PLACEHOLDER_OPTION_PATTERNS.some((pattern) => pattern.test(normalizedText))

const getComboboxOptionTexts = (option: HTMLElement): string[] => {
  const rawValues = [
    option.textContent ?? "",
    option.getAttribute("aria-label") ?? "",
    option.getAttribute("data-value") ?? "",
    option.getAttribute("title") ?? ""
  ]

  return Array.from(new Set(rawValues.map((value) => value.trim()).filter(Boolean)))
}

const getComboboxContextToken = (input: HTMLInputElement): string => {
  const source = input.id.trim() || input.getAttribute("name")?.trim() || ""
  return source.toLowerCase()
}

const getVisibleComboboxOptions = (input: HTMLInputElement): HTMLElement[] => {
  const ariaControlsId = input.getAttribute("aria-controls")?.trim() ?? ""

  const scopedOptions = (() => {
    if (!ariaControlsId) {
      return []
    }

    const listbox = input.ownerDocument.getElementById(ariaControlsId)
    if (!(listbox instanceof HTMLElement)) {
      return []
    }

    return Array.from(listbox.querySelectorAll(COMBOBOX_OPTION_SELECTOR)).filter(
      (node): node is HTMLElement => node instanceof HTMLElement && isElementVisible(node)
    )
  })()

  if (scopedOptions.length > 0) {
    return scopedOptions
  }

  const globalOptions = Array.from(
    input.ownerDocument.querySelectorAll(COMBOBOX_OPTION_SELECTOR)
  ).filter(
    (node): node is HTMLElement => node instanceof HTMLElement && isElementVisible(node)
  )

  if (globalOptions.length === 0) {
    return []
  }

  const contextToken = getComboboxContextToken(input)
  if (!contextToken) {
    return globalOptions
  }

  const contextualOptions = globalOptions.filter((option) => {
    const merged = [
      option.id,
      option.getAttribute("aria-labelledby") ?? "",
      option.closest("[id]")?.id ?? "",
      option.closest("[data-value]")?.getAttribute("data-value") ?? ""
    ]
      .join(" ")
      .toLowerCase()

    return merged.includes(contextToken)
  })

  return contextualOptions.length > 0 ? contextualOptions : globalOptions
}

const openComboboxOptions = async (input: HTMLInputElement): Promise<void> => {
  input.focus()
  input.click()

  emitKeyboardAction(input, "ArrowDown", "ArrowDown")

  const attempts = Math.ceil(COMBOBOX_OPEN_WAIT_MS / COMBOBOX_POLL_INTERVAL_MS)
  for (let index = 0; index < attempts; index += 1) {
    if (getVisibleComboboxOptions(input).length > 0) {
      return
    }

    await delay(COMBOBOX_POLL_INTERVAL_MS)
  }
}

const getBestMatchingComboboxOption = (
  input: HTMLInputElement,
  profileValue: AutofillValue | undefined
): HTMLElement | null => {
  const options = getVisibleComboboxOptions(input)
  if (options.length === 0) {
    return null
  }

  const profileValues = toProfileStringValues(profileValue)
    .map(normalizeMatchText)
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

    let score = 0

    for (const optionText of normalizedOptionTexts) {
      for (const profileItem of profileValues) {
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

    if (profileNumber !== null) {
      const numericMatch = optionTexts.some((text) =>
        matchesNumericRange(text, profileNumber)
      )
      if (numericMatch) {
        score = Math.max(score, 2.5)
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestOption = option
    }
  }

  return bestScore > 0 ? bestOption : null
}

const waitForComboboxOptions = async (input: HTMLInputElement): Promise<void> => {
  const attempts = Math.ceil(COMBOBOX_OPEN_WAIT_MS / COMBOBOX_POLL_INTERVAL_MS)

  for (let index = 0; index < attempts; index += 1) {
    if (getVisibleComboboxOptions(input).length > 0) {
      return
    }

    await delay(COMBOBOX_POLL_INTERVAL_MS)
  }
}

const isComboboxSelectionCommitted = (input: HTMLInputElement): boolean => {
  const ariaExpanded = input.getAttribute("aria-expanded")?.toLowerCase()
  if (ariaExpanded === "false") {
    return true
  }

  const shell = input.closest(".select-shell")
  if (!(shell instanceof HTMLElement)) {
    return false
  }

  const selectedValue = shell.querySelector(
    "[class*='single-value'], [class*='singleValue'], .select__single-value"
  )

  return Boolean(selectedValue?.textContent?.trim())
}

const commitComboboxWithKeyboard = async (
  input: HTMLInputElement
): Promise<boolean> => {
  emitKeyboardAction(input, "ArrowDown", "ArrowDown")
  await delay(COMBOBOX_POLL_INTERVAL_MS)
  emitKeyboardAction(input, "Enter", "Enter")
  await delay(COMBOBOX_POLL_INTERVAL_MS)
  return isComboboxSelectionCommitted(input)
}

const applyToCombobox = async (
  input: HTMLInputElement,
  profileValue: AutofillValue | undefined
): Promise<boolean> => {
  const typedValue = toNumberInputValue(profileValue) ?? toStringValue(profileValue)
  if (!typedValue) {
    return false
  }

  await openComboboxOptions(input)
  setNativeValue(input, typedValue)
  dispatchFieldEvents(input)
  await waitForComboboxOptions(input)

  const matchedOption = getBestMatchingComboboxOption(input, profileValue)
  if (matchedOption) {
    matchedOption.scrollIntoView({ block: "nearest" })
    dispatchComboboxOptionPointerEvents(matchedOption)
    matchedOption.click()
    await delay(COMBOBOX_POLL_INTERVAL_MS)
    if (isComboboxSelectionCommitted(input)) {
      dispatchFieldEvents(input)
      return true
    }

    const keyboardCommitted = await commitComboboxWithKeyboard(input)
    if (keyboardCommitted) {
      dispatchFieldEvents(input)
      return true
    }

    dispatchFieldEvents(input)
    return isComboboxSelectionCommitted(input)
  }

  const keyboardCommitted = await commitComboboxWithKeyboard(input)
  if (keyboardCommitted) {
    dispatchFieldEvents(input)
    return true
  }

  emitKeyboardAction(input, "Escape", "Escape")
  return false
}

const findAssociatedSelectForComboboxButton = (
  button: HTMLButtonElement
): HTMLSelectElement | null => {
  const scope = button.closest("form") ?? document
  const candidates = Array.from(scope.querySelectorAll("select")).filter(
    (element): element is HTMLSelectElement => element instanceof HTMLSelectElement
  )

  if (candidates.length === 0) {
    return null
  }

  const buttonName = button.getAttribute("name")?.trim() ?? ""
  const buttonId = button.id.trim()

  const byName = candidates.find((select) => {
    if (!buttonName) {
      return false
    }

    const selectName = select.name.trim()
    const selectId = select.id.trim()
    return selectName === buttonName || selectId === buttonName
  })

  if (byName) {
    return byName
  }

  const byId = candidates.find((select) => {
    if (!buttonId) {
      return false
    }

    const selectName = select.name.trim()
    const selectId = select.id.trim()
    return selectName === buttonId || selectId === buttonId
  })

  if (byId) {
    return byId
  }

  const nearbySelect = button.parentElement?.querySelector("select")
  if (nearbySelect instanceof HTMLSelectElement) {
    return nearbySelect
  }

  return null
}

const collectVisibleButtonComboboxInputs = (): HTMLInputElement[] =>
  Array.from(document.querySelectorAll(BUTTON_COMBOBOX_INPUT_SELECTOR)).filter(
    (element): element is HTMLInputElement =>
      element instanceof HTMLInputElement && isElementVisible(element)
  )

const getButtonComboboxOptions = (
  button: HTMLButtonElement,
  beforeOptions: ReadonlySet<HTMLElement>
): HTMLElement[] => {
  const ariaControlsId = button.getAttribute("aria-controls")?.trim() ?? ""

  if (ariaControlsId) {
    const controlledElement = document.getElementById(ariaControlsId)
    if (controlledElement instanceof HTMLElement) {
      const controlledOptions = Array.from(
        controlledElement.querySelectorAll(BUTTON_COMBOBOX_OPTION_SELECTOR)
      ).filter(
        (option): option is HTMLElement =>
          option instanceof HTMLElement &&
          option !== button &&
          isElementVisible(option) &&
          Boolean(option.textContent?.trim())
      )

      if (controlledOptions.length > 0) {
        return controlledOptions
      }
    }
  }

  const freshOptions = Array.from(
    document.querySelectorAll(BUTTON_COMBOBOX_OPTION_SELECTOR)
  ).filter(
    (option): option is HTMLElement =>
      option instanceof HTMLElement &&
      option !== button &&
      isElementVisible(option) &&
      Boolean(option.textContent?.trim()) &&
      !beforeOptions.has(option)
  )

  if (freshOptions.length > 0) {
    return freshOptions
  }

  return Array.from(document.querySelectorAll(BUTTON_COMBOBOX_OPTION_SELECTOR)).filter(
    (option): option is HTMLElement =>
      option instanceof HTMLElement &&
      option !== button &&
      isElementVisible(option) &&
      Boolean(option.textContent?.trim())
  )
}

const getBestMatchingOptionFromList = (
  options: HTMLElement[],
  profileValue: AutofillValue | undefined
): HTMLElement | null => {
  if (options.length === 0) {
    return null
  }

  const profileValues = toProfileStringValues(profileValue)
    .map(normalizeMatchText)
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

    let score = 0

    for (const optionText of normalizedOptionTexts) {
      for (const profileItem of profileValues) {
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

    if (profileNumber !== null) {
      const numericMatch = optionTexts.some((text) =>
        matchesNumericRange(text, profileNumber)
      )
      if (numericMatch) {
        score = Math.max(score, 2.5)
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestOption = option
    }
  }

  return bestScore > 0 ? bestOption : null
}

const isButtonComboboxCommitted = (
  button: HTMLButtonElement,
  previousText: string
): boolean => {
  const nextText = normalizeMatchText(button.textContent ?? "")
  if (!nextText || nextText === previousText) {
    return false
  }

  const likelyPlaceholder =
    nextText === "search location" ||
    nextText.startsWith("select ") ||
    nextText.startsWith("search ")

  return !likelyPlaceholder
}

const applyToButtonCombobox = async (
  button: HTMLButtonElement,
  profileValue: AutofillValue | undefined
): Promise<boolean> => {
  const selectFallback = findAssociatedSelectForComboboxButton(button)
  if (selectFallback) {
    const applied = applyToSelect(selectFallback, profileValue)
    if (applied) {
      dispatchFieldEvents(selectFallback)
      dispatchFieldEvents(button)
      return true
    }
  }

  const typedValue = toNumberInputValue(profileValue) ?? toStringValue(profileValue)
  if (!typedValue) {
    return false
  }

  const previousText = normalizeMatchText(button.textContent ?? "")
  const beforeInputs = new Set(collectVisibleButtonComboboxInputs())
  const beforeOptions = new Set(
    Array.from(document.querySelectorAll(BUTTON_COMBOBOX_OPTION_SELECTOR)).filter(
      (option): option is HTMLElement =>
        option instanceof HTMLElement && isElementVisible(option)
    )
  )

  button.focus()
  button.click()
  emitKeyboardAction(button, "ArrowDown", "ArrowDown")
  await delay(COMBOBOX_POLL_INTERVAL_MS)

  const searchInput = collectVisibleButtonComboboxInputs().find(
    (input) => !beforeInputs.has(input)
  )
  if (searchInput) {
    setNativeValue(searchInput, typedValue)
    dispatchFieldEvents(searchInput)
    await delay(COMBOBOX_POLL_INTERVAL_MS)
  }

  const options = getButtonComboboxOptions(button, beforeOptions)
  const matchedOption = getBestMatchingOptionFromList(options, profileValue)

  if (matchedOption) {
    matchedOption.scrollIntoView({ block: "nearest" })
    dispatchComboboxOptionPointerEvents(matchedOption)
    matchedOption.click()
    await delay(COMBOBOX_POLL_INTERVAL_MS)
  } else if (searchInput) {
    emitKeyboardAction(searchInput, "ArrowDown", "ArrowDown")
    await delay(COMBOBOX_POLL_INTERVAL_MS)
    emitKeyboardAction(searchInput, "Enter", "Enter")
    await delay(COMBOBOX_POLL_INTERVAL_MS)
  } else {
    emitKeyboardAction(button, "Enter", "Enter")
    await delay(COMBOBOX_POLL_INTERVAL_MS)
  }

  const committed = isButtonComboboxCommitted(button, previousText)
  if (committed) {
    dispatchFieldEvents(button)
    return true
  }

  if (searchInput) {
    emitKeyboardAction(searchInput, "Escape", "Escape")
  } else {
    emitKeyboardAction(button, "Escape", "Escape")
  }

  return false
}

const fillFieldValue = async (
  result: Layer1Result,
  value: AutofillValue | undefined,
  options: { allowNonResolved?: boolean } = {}
): Promise<FillActionResult> => {
  const allowNonResolved = options.allowNonResolved === true

  if (result.status !== LayerStatus.Resolved && !allowNonResolved) {
    return {
      fieldId: result.fieldId,
      fieldType: result.fieldType,
      filled: false,
      reason: "Field is not resolved by autofill layers."
    }
  }

  if (!result.fillable) {
    return {
      fieldId: result.fieldId,
      fieldType: result.fieldType,
      filled: false,
      reason: result.skipReason ?? "Field is not fillable."
    }
  }

  const { element } = result

  if (
    result.controlKind === ControlKind.Boolean ||
    isInputWithBooleanValue(element)
  ) {
    if (!isInputWithBooleanValue(element)) {
      return {
        fieldId: result.fieldId,
        fieldType: result.fieldType,
        filled: false,
        reason: "Boolean control does not support checked assignment."
      }
    }

    const inputType = element.type.toLowerCase()

    if (inputType === "radio") {
      if (isOptionMatchedByProfile(element, value)) {
        setNativeChecked(element, true)
        dispatchFieldEvents(element)

        return {
          fieldId: result.fieldId,
          fieldType: result.fieldType,
          filled: true
        }
      }

      return {
        fieldId: result.fieldId,
        fieldType: result.fieldType,
        filled: false,
        reason: "Profile value does not match this radio option."
      }
    }

    const booleanValue = toBooleanValue(value)
    if (typeof booleanValue === "boolean") {
      setNativeChecked(element, booleanValue)
      dispatchFieldEvents(element)

      return {
        fieldId: result.fieldId,
        fieldType: result.fieldType,
        filled: true
      }
    }

    if (isOptionMatchedByProfile(element, value)) {
      setNativeChecked(element, true)
      dispatchFieldEvents(element)

      return {
        fieldId: result.fieldId,
        fieldType: result.fieldType,
        filled: true
      }
    }

    return {
      fieldId: result.fieldId,
      fieldType: result.fieldType,
      filled: false,
      reason: "Profile value does not match this option."
    }
  }

  if (
    element instanceof HTMLInputElement &&
    element.type.toLowerCase() === "file"
  ) {
    if (result.fieldType !== FieldType.Resume) {
      return {
        fieldId: result.fieldId,
        fieldType: result.fieldType,
        filled: false,
        reason: "Only resume/CV file fields are supported."
      }
    }

    const resumeFile = getBundledResumeFile()
    if (!resumeFile) {
      return {
        fieldId: result.fieldId,
        fieldType: result.fieldType,
        filled: false,
        reason: "Bundled resume file is unavailable."
      }
    }

    const assigned = setNativeFiles(element, [resumeFile])
    if (!assigned) {
      return {
        fieldId: result.fieldId,
        fieldType: result.fieldType,
        filled: false,
        reason: "Browser blocked programmatic file assignment."
      }
    }

    dispatchFieldEvents(element)
    return {
      fieldId: result.fieldId,
      fieldType: result.fieldType,
      filled: true
    }
  }

  if (element instanceof HTMLSelectElement) {
    const applied = applyToSelect(element, value)
    if (!applied) {
      return {
        fieldId: result.fieldId,
        fieldType: result.fieldType,
        filled: false,
        reason: "Profile value does not match available select options."
      }
    }

    dispatchFieldEvents(element)
    return {
      fieldId: result.fieldId,
      fieldType: result.fieldType,
      filled: true
    }
  }

  if (isButtonCombobox(element)) {
    if (
      result.fieldType === FieldType.Country &&
      isInternationalPhoneCountrySelectorButton(element)
    ) {
      return {
        fieldId: result.fieldId,
        fieldType: result.fieldType,
        filled: false,
        reason:
          "Skipped phone country selector to avoid clearing already-entered phone digits."
      }
    }

    const applied = await applyToButtonCombobox(element, value)
    return {
      fieldId: result.fieldId,
      fieldType: result.fieldType,
      filled: applied,
      reason: applied
        ? undefined
        : "Button combobox options did not match profile value."
    }
  }

  const stringValue = toStringValue(value)
  if (!stringValue) {
    return {
      fieldId: result.fieldId,
      fieldType: result.fieldType,
      filled: false,
      reason: "No compatible string profile value."
    }
  }

  // --- Split phone: country code select + number input ---
  if (
    result.fieldType === FieldType.Phone &&
    element instanceof HTMLInputElement &&
    element.type.toLowerCase() !== "file"
  ) {
    const nearbyCodeSelect = findNearbyCountryCodeSelect(element)
    if (nearbyCodeSelect) {
      const appliedCode = applyCountryCodeToSelect(nearbyCodeSelect, stringValue)
      if (appliedCode) {
        const localNumber = stripCountryCodePrefix(stringValue, appliedCode)
        setNativeValue(element, localNumber)
        dispatchFieldEvents(element)
        return {
          fieldId: result.fieldId,
          fieldType: result.fieldType,
          filled: true
        }
      }
    }
  }

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    if (
      element instanceof HTMLInputElement &&
      result.fieldType === FieldType.DateOfBirth
    ) {
      const candidates = toDateInputCandidateValues(value)
      if (candidates.length === 0) {
        return {
          fieldId: result.fieldId,
          fieldType: result.fieldType,
          filled: false,
          reason: "No compatible date-of-birth value."
        }
      }

      for (const candidate of candidates) {
        setNativeValue(element, candidate)
        dispatchFieldEvents(element)
        element.dispatchEvent(new Event("blur", { bubbles: true }))

        if (normalizeMatchText(element.value) === normalizeMatchText(candidate)) {
          return {
            fieldId: result.fieldId,
            fieldType: result.fieldType,
            filled: true
          }
        }
      }

      return {
        fieldId: result.fieldId,
        fieldType: result.fieldType,
        filled: false,
        reason: "Date picker rejected provided date-of-birth formats."
      }
    }

    if (
      element instanceof HTMLInputElement &&
      element.type.toLowerCase() === "number"
    ) {
      const numberValue = toNumberInputValue(value)
      if (!numberValue) {
        return {
          fieldId: result.fieldId,
          fieldType: result.fieldType,
          filled: false,
          reason: "No compatible numeric profile value."
        }
      }

      setNativeValue(element, numberValue)
      dispatchFieldEvents(element)

      const isAssigned =
        element.value === numberValue ||
        (element.value.length > 0 &&
          Number(element.value) === Number(numberValue))

      return {
        fieldId: result.fieldId,
        fieldType: result.fieldType,
        filled: isAssigned,
        reason: isAssigned
          ? undefined
          : "Numeric input rejected the provided value."
      }
    }

    if (element instanceof HTMLInputElement && isComboboxInput(element)) {
      const applied = await applyToCombobox(element, value)
      return {
        fieldId: result.fieldId,
        fieldType: result.fieldType,
        filled: applied,
        reason: applied
          ? undefined
          : "Combobox options did not match profile value."
      }
    }

    setNativeValue(element, stringValue)
    dispatchFieldEvents(element)
    return {
      fieldId: result.fieldId,
      fieldType: result.fieldType,
      filled: true
    }
  }

  if (
    element instanceof HTMLElement &&
    applyToCustomElement(element, stringValue)
  ) {
    return {
      fieldId: result.fieldId,
      fieldType: result.fieldType,
      filled: true
    }
  }

  return {
    fieldId: result.fieldId,
    fieldType: result.fieldType,
    filled: false,
    reason: "Unsupported control type for fill operation."
  }
}

const hasStrongLabelSignals = (result: Layer1Result): boolean =>
  STRONG_LABEL_SIGNALS.some(
    (signalType) => (result.signals[signalType] ?? []).length > 0
  )

const shouldUseAggressiveLabelFill = (result: Layer1Result): boolean => {
  if (result.status === LayerStatus.Resolved) {
    return false
  }

  if (result.status !== LayerStatus.Ambiguous) {
    return false
  }

  if (result.fieldType === FieldType.Unknown) {
    return false
  }

  if (result.controlKind === ControlKind.Boolean) {
    return false
  }

  if (result.confidence < AGGRESSIVE_LABEL_FILL_MIN_CONFIDENCE) {
    return false
  }

  return hasStrongLabelSignals(result)
}

const fillAshbyAutofillPaneResume = (): FillActionResult | null => {
  const paneInput = document.querySelector(ASHBY_AUTOFILL_PANE_FILE_SELECTOR)

  if (!(paneInput instanceof HTMLInputElement)) {
    return null
  }

  if (paneInput.disabled) {
    return {
      fieldId: "ashby-autofill-pane-resume",
      fieldType: FieldType.Resume,
      filled: false,
      reason: "Ashby autofill resume input is disabled."
    }
  }

  if (paneInput.files && paneInput.files.length > 0) {
    return {
      fieldId: "ashby-autofill-pane-resume",
      fieldType: FieldType.Resume,
      filled: false,
      reason: "Ashby autofill resume input already has a file."
    }
  }

  const resumeFile = getBundledResumeFile()
  if (!resumeFile) {
    return {
      fieldId: "ashby-autofill-pane-resume",
      fieldType: FieldType.Resume,
      filled: false,
      reason: "Bundled resume file is unavailable."
    }
  }

  const assigned = setNativeFiles(paneInput, [resumeFile])
  if (!assigned) {
    return {
      fieldId: "ashby-autofill-pane-resume",
      fieldType: FieldType.Resume,
      filled: false,
      reason: "Browser blocked programmatic file assignment for Ashby autofill."
    }
  }

  dispatchFieldEvents(paneInput)

  return {
    fieldId: "ashby-autofill-pane-resume",
    fieldType: FieldType.Resume,
    filled: true
  }
}

const fillResumeDropzoneResume = (): FillActionResult | null => {
  const resumeFile = getBundledResumeFile()
  if (!resumeFile) {
    return null
  }

  const dropzones = Array.from(
    document.querySelectorAll(RESUME_DROPZONE_SELECTOR)
  ).filter(
    (element): element is DropzoneLikeElement =>
      element instanceof HTMLElement && isLikelyResumeDropzone(element)
  )

  if (dropzones.length === 0) {
    return null
  }

  for (const dropzone of dropzones) {
    const fileInput = findResumeDropzoneFileInput(dropzone)

    if (!fileInput) {
      continue
    }

    if (assignResumeToFileInput(fileInput, resumeFile)) {
      return {
        fieldId: "resume-dropzone-fallback",
        fieldType: FieldType.Resume,
        filled: true
      }
    }
  }

  return {
    fieldId: "resume-dropzone-fallback",
    fieldType: FieldType.Resume,
    filled: false,
    reason: "Resume dropzone detected but its file input rejected assignment."
  }
}

const fillResumeFileInputFallback = (): FillActionResult | null => {
  const resumeFile = getBundledResumeFile()
  if (!resumeFile) {
    return null
  }

  const fileInputs = getCandidateResumeFileInputs()

  if (fileInputs.length === 0) {
    return null
  }

  let sawAssignableResumeInput = false

  for (const input of fileInputs) {
    if (input.disabled) {
      continue
    }

    if (input.files && input.files.length > 0) {
      continue
    }

    sawAssignableResumeInput = true

    if (assignResumeToFileInput(input, resumeFile)) {
      return {
        fieldId: "resume-file-input-fallback",
        fieldType: FieldType.Resume,
        filled: true
      }
    }
  }

  if (!sawAssignableResumeInput) {
    return null
  }

  return {
    fieldId: "resume-file-input-fallback",
    fieldType: FieldType.Resume,
    filled: false,
    reason: "Resume file input detected but programmatic assignment was rejected."
  }
}

const fillGoogleFormsResumeUpload = async (): Promise<FillActionResult | null> => {
  if (!isGoogleFormsPage()) {
    return null
  }

  const resumeFile = getBundledResumeFile()
  if (!resumeFile) {
    return {
      fieldId: "google-forms-resume-upload",
      fieldType: FieldType.Resume,
      filled: false,
      reason: "Bundled resume file is unavailable."
    }
  }

  const existingInput = getLikelyResumeFileInput()
  if (existingInput) {
    const assigned = assignResumeToFileInput(existingInput, resumeFile)
    return {
      fieldId: "google-forms-resume-upload",
      fieldType: FieldType.Resume,
      filled: assigned,
      reason: assigned
        ? undefined
        : "Google Forms file input rejected programmatic assignment."
    }
  }

  const resumeTriggers = Array.from(
    document.querySelectorAll(GOOGLE_FORMS_RESUME_TRIGGER_SELECTOR)
  ).filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement && isLikelyGoogleFormsResumeTrigger(element)
  )

  if (resumeTriggers.length === 0) {
    return null
  }

  for (const trigger of resumeTriggers) {
    const beforeInputs = new Set(getAllFileInputs())
    trigger.click()

    const input = await waitForResumeFileInputAfterTrigger(
      beforeInputs,
      GOOGLE_FORMS_RESUME_INPUT_WAIT_MS,
      { allowAnyFileInput: true }
    )

    if (!input) {
      continue
    }

    const assigned = assignResumeToFileInput(input, resumeFile)
    return {
      fieldId: "google-forms-resume-upload",
      fieldType: FieldType.Resume,
      filled: assigned,
      reason: assigned
        ? undefined
        : "Google Forms file input rejected programmatic assignment."
    }
  }

  return {
    fieldId: "google-forms-resume-upload",
    fieldType: FieldType.Resume,
    filled: false,
    reason:
      "Google Forms did not expose a fillable file input. Click 'Add file' once and rerun Fill Form."
  }
}

const fillGooglePickerResumeUpload = async (): Promise<FillActionResult | null> => {
  if (!isLikelyGooglePickerDialog()) {
    return null
  }

  const resumeFile = getBundledResumeFile()
  if (!resumeFile) {
    return {
      fieldId: "google-picker-resume-upload",
      fieldType: FieldType.Resume,
      filled: false,
      reason: "Bundled resume file is unavailable."
    }
  }

  const existingInput = getAnyAssignableFileInput()
  if (existingInput) {
    const assigned = assignResumeToFileInput(existingInput, resumeFile)
    return {
      fieldId: "google-picker-resume-upload",
      fieldType: FieldType.Resume,
      filled: assigned,
      reason: assigned
        ? undefined
        : "Google picker file input rejected programmatic assignment."
    }
  }

  const browseButtons = Array.from(
    document.querySelectorAll(GOOGLE_PICKER_BROWSE_SELECTOR)
  ).filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement && isElementVisible(element)
  )

  for (const browseButton of browseButtons) {
    const beforeInputs = new Set(getAllFileInputs())
    browseButton.click()

    const input = await waitForResumeFileInputAfterTrigger(
      beforeInputs,
      GOOGLE_FORMS_RESUME_INPUT_WAIT_MS,
      { allowAnyFileInput: true }
    )

    if (!input) {
      continue
    }

    const assigned = assignResumeToFileInput(input, resumeFile)
    return {
      fieldId: "google-picker-resume-upload",
      fieldType: FieldType.Resume,
      filled: assigned,
      reason: assigned
        ? undefined
        : "Google picker file input rejected programmatic assignment."
    }
  }

  return {
    fieldId: "google-picker-resume-upload",
    fieldType: FieldType.Resume,
    filled: false,
    reason:
      "Google picker did not expose an assignable file input. Manual file selection is required."
  }
}

export const fillResolvedFields = async (
  results: Layer1Result[],
  profile: AutofillProfile
): Promise<FillActionResult[]> => {
  const actions: FillActionResult[] = []

  for (const result of results) {
    const aggressiveFill = shouldUseAggressiveLabelFill(result)

    if (result.status !== LayerStatus.Resolved && !aggressiveFill) {
      continue
    }

    const profileValue = resolveProfileValueForField(result, profile)
    const action = await fillFieldValue(result, profileValue, {
      allowNonResolved: aggressiveFill
    })
    actions.push(action)
  }

  // Ashby has an optional "Autofill from resume" pane that is separate from
  // the normal application resume field; upload there too when present.
  const ashbyPaneAction = fillAshbyAutofillPaneResume()
  if (ashbyPaneAction) {
    actions.push(ashbyPaneAction)
  }

  const dropzoneAction = fillResumeDropzoneResume()
  if (dropzoneAction) {
    actions.push(dropzoneAction)
  }

  const resumeInputFallbackAction = fillResumeFileInputFallback()
  if (resumeInputFallbackAction) {
    actions.push(resumeInputFallbackAction)
  }

  const googleFormsResumeAction = await fillGoogleFormsResumeUpload()
  if (googleFormsResumeAction) {
    actions.push(googleFormsResumeAction)
  }

  const googlePickerResumeAction = await fillGooglePickerResumeUpload()
  if (googlePickerResumeAction) {
    actions.push(googlePickerResumeAction)
  }

  return actions
}
