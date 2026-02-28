import { AutofillProfile, FieldType } from "~src/content/autofill/types"

const STORAGE_KEY = "autofill_profile"

export const DEFAULT_AUTOFILL_PROFILE: AutofillProfile = {
  [FieldType.FirstName]: "Abdus",
  [FieldType.LastName]: "Samad",
  [FieldType.FullName]: "Abdus Samad",
  [FieldType.Email]: "samad.abdus3535@gmail.com",
  [FieldType.Phone]: "+919654405340",
  [FieldType.AddressLine1]: "4137, Urdu Bazar, Jama Masjid, 110006",
  [FieldType.AddressLine2]: "4137, Urdu Bazar, Jama Masjid, 110006",
  [FieldType.City]: "Delhi",
  [FieldType.State]: "Delhi",
  [FieldType.PostalCode]: "110006",
  [FieldType.Country]: "India",
  [FieldType.Company]: "Caw Studios",
  [FieldType.JobTitle]: "Software Engineer",
  [FieldType.CurrentCtc]: "2300000",
  [FieldType.ExpectedCtc]: "3200000",
  [FieldType.NoticePeriod]: "23rd March 2026",
  [FieldType.LinkedIn]: "https://www.linkedin.com/in/asamad35/",
  [FieldType.GitHub]: "https://github.com/asamad35",
  [FieldType.Website]: "https://asamad.vercel.app/"
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
