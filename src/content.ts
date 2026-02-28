import type { PlasmoCSConfig } from "plasmo"

import {
  runLayer1Autofill,
  toLayer1RunSnapshot
} from "~src/content/autofill/orchestrator"
import { loadAutofillProfile } from "~src/content/autofill/profile"
import {
  FillFormResponse,
  isFillFormMessage
} from "~src/shared/autofill-messages"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_idle"
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isFillFormMessage(message)) {
      return
    }

    void (async () => {
      try {
        const profile = await loadAutofillProfile()
        const summary = runLayer1Autofill(profile, { debug: message.debug })
        const response: FillFormResponse = {
          ok: true,
          summary: toLayer1RunSnapshot(summary)
        }
        sendResponse(response)
      } catch (error) {
        const response: FillFormResponse = {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Autofill execution failed."
        }
        sendResponse(response)
      }
    })()

    return true
  }
)
