import bundledResumeDataUrl from "data-url:../../../../Samad_Resume.pdf"
import {
  dataUrlToFile,
  delay,
  getAssociatedLabelText,
  getNearestUploadContainerText,
  setNativeFiles
} from "~src/content/autofill/layer1/fill-utils"
import { FieldType, FillActionResult } from "~src/content/autofill/types"

let cachedBundledResumeFile: File | null | undefined

interface DropzoneLikeElement extends HTMLElement {
  dropzone?: {
    hiddenFileInput?: HTMLInputElement
  }
}

export const getBundledResumeFile = (): File | undefined => {
  if (cachedBundledResumeFile !== undefined) {
    return cachedBundledResumeFile ?? undefined
  }

  const file = dataUrlToFile(bundledResumeDataUrl, "Samad_Resume.pdf")
  cachedBundledResumeFile = file ?? null
  return file
}

export const assignResumeToFileInput = (
  input: HTMLInputElement,
  resumeFile: File
): boolean => {
  const success = setNativeFiles(input, [resumeFile])
  if (success) {
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  }
  return success
}

export const hasResumeHint = (rawText: string): boolean => {
  const text = rawText.toLowerCase().replace(/[^a-z]/g, "")
  return (
    text.includes("resume") || text.includes("cv") || text.includes("curriculumvitae")
  )
}

export const isLikelyResumeDropzone = (element: HTMLElement): boolean => {
  const classes = element.className?.toLowerCase?.() ?? ""
  if (
    classes.includes("dropzone") ||
    classes.includes("upload") ||
    element.hasAttribute("data-dropzone")
  ) {
    return hasResumeHint(getNearestUploadContainerText(element))
  }
  return false
}

export const findResumeDropzoneFileInput = (
  dropzoneElement: DropzoneLikeElement
): HTMLInputElement | null => {
  if (dropzoneElement.dropzone?.hiddenFileInput) {
    return dropzoneElement.dropzone.hiddenFileInput
  }

  const inputs = Array.from(dropzoneElement.querySelectorAll("input[type='file']"))
  for (const input of inputs) {
    if (input instanceof HTMLInputElement) {
      return input
    }
  }

  let wrapper = dropzoneElement.parentElement
  for (let limit = 0; limit < 3; limit += 1) {
    if (!wrapper) {
      break
    }

    const wrapperInputs = Array.from(wrapper.querySelectorAll("input[type='file']"))
    for (const input of wrapperInputs) {
      if (input instanceof HTMLInputElement) {
        return input
      }
    }

    wrapper = wrapper.parentElement
  }

  return null
}

export const isLikelyResumeAcceptType = (acceptValue: string): boolean => {
  const normalized = acceptValue.toLowerCase()
  return (
    normalized.includes("pdf") ||
    normalized.includes("doc") ||
    normalized.includes("rtf") ||
    normalized === "*"
  )
}

export const isLikelyResumeFileInput = (input: HTMLInputElement): boolean => {
  const acceptMatch = isLikelyResumeAcceptType(input.getAttribute("accept") ?? "")
  if (acceptMatch) {
    return true
  }

  const nameMatch = hasResumeHint(input.name || input.id)
  if (nameMatch) {
    return true
  }

  const labelMatch = hasResumeHint(getAssociatedLabelText(input))
  if (labelMatch) {
    return true
  }

  const containerMatch = hasResumeHint(getNearestUploadContainerText(input))
  if (containerMatch) {
    return true
  }

  return false
}

export const getCandidateResumeFileInputs = (): HTMLInputElement[] => {
  const allFileInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>("input[type='file']")
  )

  const candidates = allFileInputs.filter(isLikelyResumeFileInput)
  return candidates.length > 0 ? candidates : allFileInputs
}

export const collectSearchRoots = (): Array<Document | ShadowRoot> => {
  const roots: Array<Document | ShadowRoot> = [document]

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    null
  )

  let node = walker.nextNode()
  while (node) {
    if (node instanceof HTMLElement && node.shadowRoot) {
      roots.push(node.shadowRoot)
    }
    node = walker.nextNode()
  }

  return roots
}

export const getAllFileInputs = (): HTMLInputElement[] => {
  const inputs: HTMLInputElement[] = []
  const roots = collectSearchRoots()

  for (const root of roots) {
    const rootInputs = Array.from(
      root.querySelectorAll<HTMLInputElement>("input[type='file']")
    )
    inputs.push(...rootInputs)
  }

  return inputs
}

export const getAnyAssignableFileInput = (
  exclude?: ReadonlySet<HTMLInputElement>
): HTMLInputElement | null => {
  const allInputs = getAllFileInputs()
  const available = allInputs.filter((input) => {
    if (exclude?.has(input)) {
      return false
    }

    const style = window.getComputedStyle(input)
    if (style.display === "none") {
      const isGoogleForms =
        input.closest("form")?.action.includes("docs.google.com/forms") ?? false
      if (!isGoogleForms) {
        return false
      }
    }

    return true
  })

  return available[0] ?? null
}

export const getLikelyResumeFileInput = (
  exclude?: ReadonlySet<HTMLInputElement>
): HTMLInputElement | null => {
  const candidates = getCandidateResumeFileInputs()
  const available = candidates.filter((input) => {
    if (exclude?.has(input)) {
      return false
    }

    if (input.files !== null && input.files.length > 0) {
      return false
    }

    return true
  })

  return available[0] ?? getAnyAssignableFileInput(exclude)
}

export const isGoogleDocsHost = (): boolean =>
  window.location.host.includes("docs.google.com")

export const isGoogleFormsPage = (): boolean =>
  isGoogleDocsHost() && window.location.pathname.includes("/forms/")

export const isLikelyGooglePickerDialog = (): boolean => {
  if (!isGoogleDocsHost() || !window.location.pathname.includes("/picker")) {
    return false
  }

  targetParams: {
    const params = new URLSearchParams(window.location.search)
    if (params.get("protocol") === "gadgets") {
      break targetParams
    }
    return false
  }

  return document.querySelector("div[role='dialog']") !== null
}

export const getTextFromIdReferences = (
  owner: Element,
  rawIds: string | null
): string => {
  if (!rawIds) {
    return ""
  }

  const safeIds = rawIds
    .split(/\s+/)
    .map((id) => (window.CSS?.escape ? window.CSS.escape(id) : id))
    .filter(Boolean)

  if (safeIds.length === 0) {
    return ""
  }

  const selector = safeIds.map((id) => `#${id}`).join(", ")
  const doc = owner.ownerDocument
  const elements = Array.from(doc.querySelectorAll(selector))

  return elements.map((el) => el.textContent ?? "").join(" ")
}

export const isLikelyGoogleFormsResumeTrigger = (element: HTMLElement): boolean => {
  if (element.getAttribute("role") !== "button") {
    return false
  }

  const isUploadButton =
    element.querySelector('path[d*="M9 16h6v-6h4l-7-7-7 7h4v6zm"]') !== null
  if (!isUploadButton) {
    return false
  }

  const labelledBy = element.getAttribute("aria-labelledby")
  const labelText = getTextFromIdReferences(element, labelledBy)

  return hasResumeHint(labelText)
}

export const waitForResumeFileInputAfterTrigger = async (
  beforeInputs: ReadonlySet<HTMLInputElement>,
  timeoutMs: number,
  options: { allowAnyFileInput?: boolean } = {}
): Promise<HTMLInputElement | null> => {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    await delay(100)

    const currentInputs = getAllFileInputs()
    const newInputs = currentInputs.filter((input) => !beforeInputs.has(input))

    if (newInputs.length > 0) {
      const candidate = newInputs.find((input) => {
        if (options.allowAnyFileInput) return true
        return isLikelyResumeFileInput(input)
      })

      if (candidate) {
        return candidate
      }
    }
  }

  return null
}

export const fillAshbyAutofillPaneResume = (): FillActionResult | null => {
  const autofillPane = document.querySelector(".ashby-application-autofill-pane")
  if (!autofillPane) {
    return null
  }

  const fileInput = autofillPane.querySelector("input[type='file']")
  if (!(fileInput instanceof HTMLInputElement)) {
    return null
  }

  const resumeFile = getBundledResumeFile()
  if (!resumeFile) {
    return {
      fieldId: "ashby-resume-upload",
      fieldType: FieldType.Resume,
      filled: false,
      reason: "Bundled resume file not found"
    }
  }

  const assigned = assignResumeToFileInput(fileInput, resumeFile)
  return assigned
    ? {
        fieldId: fileInput.id || "ashby-resume-upload",
        fieldType: FieldType.Resume,
        filled: true
      }
    : {
        fieldId: fileInput.id || "ashby-resume-upload",
        fieldType: FieldType.Resume,
        filled: false,
        reason: "Failed to set native files property for Ashby"
      }
}

export const fillResumeDropzoneResume = (): FillActionResult | null => {
  const dropzones = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".dropzone, [data-dropzone], [class*='dropzone'], [class*='upload']"
    )
  )

  const targetDropzone = dropzones.find(isLikelyResumeDropzone)
  if (!targetDropzone) {
    return null
  }

  const dropzoneInput = findResumeDropzoneFileInput(targetDropzone)
  if (!dropzoneInput) {
    return null
  }

  const resumeFile = getBundledResumeFile()
  if (!resumeFile) {
    return {
      fieldId: "dropzone-resume",
      fieldType: FieldType.Resume,
      filled: false,
      reason: "Bundled resume file not found"
    }
  }

  const assigned = assignResumeToFileInput(dropzoneInput, resumeFile)
  return assigned
    ? {
        fieldId: dropzoneInput.id || "dropzone-resume",
        fieldType: FieldType.Resume,
        filled: true
      }
    : {
        fieldId: dropzoneInput.id || "dropzone-resume",
        fieldType: FieldType.Resume,
        filled: false,
        reason: "Failed to assign resume to dropzone input"
      }
}

export const fillResumeFileInputFallback = (): FillActionResult | null => {
  const resumeFile = getBundledResumeFile()
  if (!resumeFile) {
    return {
      fieldId: "fallback-resume",
      fieldType: FieldType.Resume,
      filled: false,
      reason: "Bundled resume file not found"
    }
  }

  const fileInput = getLikelyResumeFileInput()

  if (!fileInput) {
    return {
      fieldId: "fallback-resume",
      fieldType: FieldType.Resume,
      filled: false,
      reason: "No candidate resume file input located"
    }
  }

  const assigned = assignResumeToFileInput(fileInput, resumeFile)

  if (!assigned) {
    return {
      fieldId: fileInput.id || "fallback-resume",
      fieldType: FieldType.Resume,
      filled: false,
      reason: "Failed to explicitly assign files property to local input element"
    }
  }

  return {
    fieldId: fileInput.id || "fallback-resume",
    fieldType: FieldType.Resume,
    filled: true
  }
}

export const fillGoogleFormsResumeUpload = async (): Promise<FillActionResult | null> => {
  if (!isGoogleFormsPage()) {
    return null
  }

  const rootNodes = collectSearchRoots()
  let triggerButton: HTMLElement | null = null

  for (const root of rootNodes) {
    const buttons = Array.from(root.querySelectorAll('div[role="button"]'))
    const candidate = buttons.find((btn) =>
      isLikelyGoogleFormsResumeTrigger(btn as HTMLElement)
    )

    if (candidate) {
      triggerButton = candidate as HTMLElement
      break
    }
  }

  if (!triggerButton) {
    return null
  }

  const beforeInputs = new Set(getAllFileInputs())

  triggerButton.click()

  const assignedInput = await waitForResumeFileInputAfterTrigger(beforeInputs, 2000, {
    allowAnyFileInput: true
  })

  if (!assignedInput) {
    return {
      fieldId: "google-forms-resume",
      fieldType: FieldType.Resume,
      filled: false,
      reason: "Timed out waiting for Google Forms upload iframe/input to appear"
    }
  }

  const resumeFile = getBundledResumeFile()
  if (!resumeFile) {
    return {
      fieldId: "google-forms-resume",
      fieldType: FieldType.Resume,
      filled: false,
      reason: "Bundled resume not found"
    }
  }

  const success = assignResumeToFileInput(assignedInput, resumeFile)

  return success
    ? {
        fieldId: assignedInput.id || "google-forms-resume",
        fieldType: FieldType.Resume,
        filled: true
      }
    : {
        fieldId: assignedInput.id || "google-forms-resume",
        fieldType: FieldType.Resume,
        filled: false,
        reason: "Failed to assign to Google Forms hidden input"
      }
}

export const fillGooglePickerResumeUpload = async (): Promise<FillActionResult | null> => {
  if (!isLikelyGooglePickerDialog()) {
    return null
  }

  const beforeInputs = new Set(getAllFileInputs())

  const deviceUploadTab = Array.from(
    document.querySelectorAll("div[role='tab']")
  ).find((tab) => {
    const text = tab.textContent?.toLowerCase() ?? ""
    return text.includes("upload") || text.includes("device")
  })

  if (deviceUploadTab instanceof HTMLElement) {
    deviceUploadTab.click()
    await delay(300)
  }

  const fileInput = await waitForResumeFileInputAfterTrigger(beforeInputs, 1500, {
    allowAnyFileInput: true
  })

  if (!fileInput) {
    return {
      fieldId: "google-picker-resume",
      fieldType: FieldType.Resume,
      filled: false,
      reason: "No file input appeared in Google Picker dialog"
    }
  }

  const resumeFile = getBundledResumeFile()
  if (!resumeFile) {
    return {
      fieldId: "google-picker-resume",
      fieldType: FieldType.Resume,
      filled: false,
      reason: "Bundled resume not found"
    }
  }

  const success = assignResumeToFileInput(fileInput, resumeFile)

  if (success) {
    await delay(200)

    const uploadButton = Array.from(
      document.querySelectorAll("div[role='button']")
    ).find((btn) => {
      const text = btn.textContent?.toLowerCase() ?? ""
      return text === "upload" || text === "insert" || text === "submit"
    })

    if (uploadButton instanceof HTMLElement) {
      uploadButton.click()
    }
  }

  return success
    ? {
        fieldId: fileInput.id || "google-picker-resume",
        fieldType: FieldType.Resume,
        filled: true
      }
    : {
        fieldId: fileInput.id || "google-picker-resume",
        fieldType: FieldType.Resume,
        filled: false,
        reason: "Failed to assign file in Google Picker"
      }
}
