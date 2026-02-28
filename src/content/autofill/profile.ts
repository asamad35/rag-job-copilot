import { AutofillProfile, FieldType } from "~src/content/autofill/types"

const STORAGE_KEY = "autofill_profile"

export const DEFAULT_AUTOFILL_PROFILE: AutofillProfile = {
  [FieldType.FirstName]: "Alex",
  [FieldType.LastName]: "Taylor",
  [FieldType.FullName]: "Alex Taylor",
  [FieldType.Email]: "alex.taylor@example.com",
  [FieldType.Phone]: "5551234567",
  [FieldType.AddressLine1]: "123 Main St",
  [FieldType.AddressLine2]: "Apt 4B",
  [FieldType.City]: "San Francisco",
  [FieldType.State]: "CA",
  [FieldType.PostalCode]: "94105",
  [FieldType.Country]: "United States",
  [FieldType.Company]: "Acme Labs",
  [FieldType.JobTitle]: "Software Engineer",
  [FieldType.LinkedIn]: "https://www.linkedin.com/in/alextaylor",
  [FieldType.GitHub]: "https://github.com/alextaylor",
  [FieldType.Website]: "https://alextaylor.dev"
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const toAutofillProfile = (value: unknown): AutofillProfile => {
  if (!isObject(value)) {
    return {}
  }

  const profile: AutofillProfile = {}

  for (const fieldType of Object.values(FieldType)) {
    if (fieldType === FieldType.Unknown) {
      continue
    }

    const rawValue = value[fieldType]
    if (typeof rawValue === "string" || typeof rawValue === "boolean") {
      profile[fieldType] = rawValue
    }
  }

  return profile
}

export const loadAutofillProfile = async (): Promise<AutofillProfile> => {
  try {
    const storageData = await new Promise<Record<string, unknown>>(
      (resolve) => {
        chrome.storage.local.get(STORAGE_KEY, (items) => {
          resolve(items as Record<string, unknown>)
        })
      }
    )

    const storedProfile = toAutofillProfile(storageData[STORAGE_KEY])
    return {
      ...DEFAULT_AUTOFILL_PROFILE,
      ...storedProfile
    }
  } catch (error) {
    console.warn("Unable to read autofill profile from storage:", error)
    return { ...DEFAULT_AUTOFILL_PROFILE }
  }
}
