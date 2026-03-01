import { useState } from "react"

import {
  FieldType,
  Layer1RunSnapshot,
  LayerStatus
} from "~src/content/autofill/types"
import { getFieldTypeLabel } from "~src/shared/field-labels"
import {
  FILL_FORM_MESSAGE_TYPE,
  FillFormResponse
} from "~src/shared/autofill-messages"

interface ActiveTabContext {
  id: number | null
  url: string
}

interface TabFrameContext {
  frameId: number
  parentFrameId: number
  url: string
}

const GOOGLE_FORMS_SECOND_PASS_DELAY_MS = 1200

const getActiveTabContext = async (): Promise<ActiveTabContext> => {
  const tabs = await new Promise<chrome.tabs.Tab[]>((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabList) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve(tabList)
    })
  })

  const activeTab = tabs[0]
  const tabId = activeTab?.id

  return {
    id: typeof tabId === "number" ? tabId : null,
    url: typeof activeTab?.url === "string" ? activeTab.url : ""
  }
}

const isUnsupportedTabUrl = (url: string): string | null => {
  const blockedSchemes = [
    "chrome://",
    "chrome-extension://",
    "edge://",
    "about:",
    "devtools://",
    "view-source:",
    "moz-extension://"
  ]

  for (const blockedScheme of blockedSchemes) {
    if (url.startsWith(blockedScheme)) {
      return "This page does not allow extension content scripts. Open a regular website tab and try again."
    }
  }

  if (url.startsWith("file://")) {
    return "Enable 'Allow access to file URLs' for this extension in chrome://extensions, then refresh the page."
  }

  return null
}

const delay = (durationMs: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, durationMs)
  })

const isGoogleFormsUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url)
    return /(^|\.)docs\.google\.com$/i.test(parsed.hostname) &&
      /\/forms\//i.test(parsed.pathname)
  } catch {
    return false
  }
}

const getTabFrames = async (tabId: number): Promise<TabFrameContext[]> => {
  if (!chrome.webNavigation?.getAllFrames) {
    return []
  }

  try {
    const frames = await new Promise<chrome.webNavigation.GetAllFrameResultDetails[]>(
      (resolve, reject) => {
        chrome.webNavigation.getAllFrames({ tabId }, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }

          resolve(result ?? [])
        })
      }
    )

    return frames
      .filter((frame): frame is Required<typeof frame> => {
        return (
          typeof frame.frameId === "number" &&
          typeof frame.parentFrameId === "number" &&
          typeof frame.url === "string"
        )
      })
      .map((frame) => ({
        frameId: frame.frameId,
        parentFrameId: frame.parentFrameId,
        url: frame.url
      }))
  } catch {
    return []
  }
}

const getFramePriority = (frame: TabFrameContext): number => {
  const url = frame.url.toLowerCase()
  let priority = frame.parentFrameId >= 0 ? 5 : 0

  const knownJobIframeHosts = [
    "mynexthire.com",
    "ashbyhq.com",
    "greenhouse.io",
    "boards.greenhouse.io",
    "job-boards.greenhouse.io",
    "lever.co"
  ]

  if (knownJobIframeHosts.some((host) => url.includes(host))) {
    priority += 10
  }

  return priority
}

const sendFillMessageToFrame = async (
  tabId: number,
  frameId?: number
): Promise<FillFormResponse> => {
  const response = await new Promise<FillFormResponse | undefined>((resolve) => {
    const message = {
      type: FILL_FORM_MESSAGE_TYPE,
      debug: true
    }

    const callback = (result: FillFormResponse | undefined) => {
      if (chrome.runtime.lastError) {
        resolve({
          ok: false,
          error: chrome.runtime.lastError.message ?? "Unable to send message."
        })
        return
      }

      resolve(result)
    }

    if (typeof frameId === "number") {
      chrome.tabs.sendMessage(tabId, message, { frameId }, callback)
      return
    }

    chrome.tabs.sendMessage(tabId, message, callback)
  })

  if (!response) {
    return {
      ok: false,
      error: "No response received from content script."
    }
  }

  return response
}

const getSnapshotScore = (summary: Layer1RunSnapshot): number =>
  summary.filled * 10000 + summary.resolved * 100 + summary.totalDiscovered

interface FillRoundResult {
  successfulResponses: FillFormResponse[]
  errors: string[]
}

const runFillRound = async (tabId: number): Promise<FillRoundResult> => {
  const frames = await getTabFrames(tabId)
  const prioritizedFrames = [...frames].sort(
    (left, right) => getFramePriority(right) - getFramePriority(left)
  )

  const attemptedFrameIds = new Set<number>()
  const successfulResponses: FillFormResponse[] = []
  const errors: string[] = []

  for (const frame of prioritizedFrames) {
    attemptedFrameIds.add(frame.frameId)
    const response = await sendFillMessageToFrame(tabId, frame.frameId)

    if (!response.ok) {
      if (response.error) {
        errors.push(response.error)
      }
      continue
    }

    successfulResponses.push(response)
  }

  if (!attemptedFrameIds.has(0)) {
    const topFrameResponse = await sendFillMessageToFrame(tabId, 0)
    if (topFrameResponse.ok) {
      successfulResponses.push(topFrameResponse)
    } else if (topFrameResponse.error) {
      errors.push(topFrameResponse.error)
    }
  }

  return {
    successfulResponses,
    errors
  }
}

const pickBestResponse = (
  responses: FillFormResponse[]
): FillFormResponse | null => {
  if (responses.length === 0) {
    return null
  }

  return responses.reduce((best, candidate) => {
    const bestScore = best.summary ? getSnapshotScore(best.summary) : 0
    const candidateScore = candidate.summary
      ? getSnapshotScore(candidate.summary)
      : 0

    return candidateScore > bestScore ? candidate : best
  })
}

const requestFillForm = async (
  tabId: number,
  tabUrl: string
): Promise<FillFormResponse> => {
  const firstRound = await runFillRound(tabId)
  const successfulResponses = [...firstRound.successfulResponses]
  const errors = [...firstRound.errors]

  if (isGoogleFormsUrl(tabUrl)) {
    await delay(GOOGLE_FORMS_SECOND_PASS_DELAY_MS)
    const secondRound = await runFillRound(tabId)
    successfulResponses.push(...secondRound.successfulResponses)
    errors.push(...secondRound.errors)
  }

  if (successfulResponses.length > 0) {
    const bestResponse = pickBestResponse(successfulResponses)

    if (bestResponse) {
      return bestResponse
    }
  }

  const noReceiverError = errors.find((error) =>
    error.includes("Receiving end does not exist")
  )

  if (noReceiverError) {
    return {
      ok: false,
      error:
        "Content script not available in this page/frame yet. Reload the page and click Fill Form again."
    }
  }

  return {
    ok: false,
    error: errors[0] ?? "Unable to send autofill message to this tab."
  }
}

interface NamedField {
  id: string
  name: string
  reason?: string
}

interface FieldGroupProps {
  title: string
  items: NamedField[]
  emptyText: string
}

const FieldGroup = ({ title, items, emptyText }: FieldGroupProps) => {
  return (
    <section className="rounded-md border border-slate-200 bg-slate-50 p-2">
      <h3 className="text-xs font-semibold text-slate-800">
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-slate-500">{emptyText}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((item) => (
            <li className="text-xs text-slate-700" key={item.id}>
              <span>{item.name}</span>
              {item.reason ? (
                <span className="text-slate-500"> - {item.reason}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const createSummaryGroups = (summary: Layer1RunSnapshot) => {
  const resultByFieldId = new Map(summary.results.map((result) => [result.fieldId, result]))
  const fillActionByFieldId = new Map(
    summary.fillActions.map((action) => [action.fieldId, action])
  )

  const totalFields: NamedField[] = summary.results.map((result) => ({
    id: result.fieldId,
    name: result.fieldName
  }))

  const resolvedFields: NamedField[] = summary.results
    .filter((result) => result.status === LayerStatus.Resolved)
    .map((result) => ({
      id: result.fieldId,
      name: result.fieldName
    }))

  const filledFields: NamedField[] = summary.fillActions
    .filter((action) => action.filled)
    .map((action) => ({
      id: action.fieldId,
      name:
        resultByFieldId.get(action.fieldId)?.fieldName ??
        getFieldTypeLabel(action.fieldType ?? FieldType.Unknown)
    }))

  const resolvedNotFilled: NamedField[] = resolvedFields
    .filter((result) => !fillActionByFieldId.get(result.id)?.filled)
    .map((result) => ({
      id: result.id,
      name: result.name,
      reason:
        fillActionByFieldId.get(result.id)?.reason ??
        "No fill action completed."
    }))

  return {
    totalFields,
    resolvedFields,
    filledFields,
    resolvedNotFilled
  }
}

export const FillFormButton = () => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [summary, setSummary] = useState<Layer1RunSnapshot | null>(null)

  const onFillFormClick = async () => {
    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setStatusMessage("")
    setSummary(null)

    try {
      const activeTab = await getActiveTabContext()
      const blockedReason = isUnsupportedTabUrl(activeTab.url)

      if (blockedReason) {
        setStatusMessage(blockedReason)
        return
      }

      if (activeTab.id === null) {
        setStatusMessage("Unable to determine active tab.")
        return
      }

      const response = await requestFillForm(activeTab.id, activeTab.url)

      if (!response.ok) {
        setStatusMessage(response.error ?? "Autofill failed due to unknown error.")
        return
      }

      setSummary(response.summary ?? null)
      const resolvedCount = response.summary?.resolved ?? 0
      const filledCount = response.summary?.filled ?? 0
      setStatusMessage(`Autofill complete: ${filledCount} filled, ${resolvedCount} resolved.`)
      console.info("Autofill summary:", response.summary)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Autofill request failed."
      setStatusMessage(message)
      console.warn("Autofill request failed:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const groups = summary ? createSummaryGroups(summary) : null

  return (
    <div className="space-y-2">
      <button
        className="w-full rounded-lg bg-red-600 px-3.5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        disabled={isSubmitting}
        onClick={onFillFormClick}
        type="button">
        {isSubmitting ? "Filling..." : "Fill Form"}
      </button>
      {statusMessage ? (
        <p className="text-xs text-slate-700" role="status">
          {statusMessage}
        </p>
      ) : null}
      {groups ? (
        <div className="space-y-2">
          <FieldGroup
            emptyText="No fields detected."
            items={groups.totalFields}
            title="Total Fields"
          />
          <FieldGroup
            emptyText="No resolved fields yet."
            items={groups.resolvedFields}
            title="Resolved Fields"
          />
          <FieldGroup
            emptyText="No fields were filled."
            items={groups.filledFields}
            title="Filled Fields"
          />
          <FieldGroup
            emptyText="No resolved-but-unfilled fields."
            items={groups.resolvedNotFilled}
            title="Resolved But Not Filled"
          />
        </div>
      ) : null}
    </div>
  )
}
