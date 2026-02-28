import { Layer1RunSnapshot } from "~src/content/autofill/types"

export const FILL_FORM_MESSAGE_TYPE = "autofill/fill-form"

export interface FillFormMessage {
  type: typeof FILL_FORM_MESSAGE_TYPE
  debug?: boolean
}

export interface FillFormResponse {
  ok: boolean
  summary?: Layer1RunSnapshot
  error?: string
}

export const isFillFormMessage = (value: unknown): value is FillFormMessage => {
  console.log("step 2")
  if (typeof value !== "object" || value === null) {
    return false
  }

  return (value as FillFormMessage).type === FILL_FORM_MESSAGE_TYPE
}
