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

const requestFillForm = async (tabId: number): Promise<FillFormResponse> => {
  const response = await new Promise<FillFormResponse | undefined>((resolve) => {
    chrome.tabs.sendMessage(
        tabId,
        {
          type: FILL_FORM_MESSAGE_TYPE,
          debug: true
        },
        (result: FillFormResponse | undefined) => {
          if (chrome.runtime.lastError) {
            const runtimeErrorMessage = chrome.runtime.lastError.message
            const noReceiver =
              runtimeErrorMessage?.includes("Receiving end does not exist") === true

            resolve({
              ok: false,
              error: noReceiver
                ? "Content script not available in this tab yet. Reload this webpage and click Fill Form again."
                : runtimeErrorMessage ?? "Unable to send autofill message to tab."
            })
            return
          }

          resolve(result)
        }
      )
    }
  )

  if (!response) {
    return {
      ok: false,
      error: "No response received from content script."
    }
  }

  return response
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

      const response = await requestFillForm(activeTab.id)

      if (!response.ok) {
        setStatusMessage(response.error ?? "Autofill failed due to unknown error.")
        return
      }

      setSummary(response.summary ?? null)
      const resolvedCount = response.summary?.resolved ?? 0
      const filledCount = response.summary?.filled ?? 0
      setStatusMessage(`Layer 1 complete: ${filledCount} filled, ${resolvedCount} resolved.`)
      console.info("Layer 1 autofill summary:", response.summary)
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
      {/* {groups ? (
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
      ) : null} */}
    </div>
  )
}
