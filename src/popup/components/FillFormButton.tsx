import { useState } from "react"

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
    console.log('step 1')  
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

export const FillFormButton = () => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")

  const onFillFormClick = async () => {
    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setStatusMessage("")

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
      console.log(response, 'response')

      if (!response.ok) {
        setStatusMessage(response.error ?? "Autofill failed due to unknown error.")
        return
      }

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
    </div>
  )
}
