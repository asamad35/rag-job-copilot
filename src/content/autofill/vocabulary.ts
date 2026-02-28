import { FIELD_TYPES, FieldType } from "~src/content/autofill/types"

export interface TextMatch {
  fieldType: FieldType
  score: number
  token: string
}

interface TokenPattern {
  token: string
  score?: number
}

type FieldTypeToken = string | TokenPattern

const GENERIC_TOKENS = new Set([
  "value",
  "input",
  "text",
  "field",
  "data",
  "contact",
  "detail",
  "details",
  "information",
  "info"
])

const AUTOCOMPLETE_TYPE_MAP: Record<string, FieldType> = {
  name: FieldType.FullName,
  "given-name": FieldType.FirstName,
  "additional-name": FieldType.FirstName,
  "family-name": FieldType.LastName,
  email: FieldType.Email,
  tel: FieldType.Phone,
  "tel-national": FieldType.Phone,
  "tel-local": FieldType.Phone,
  "tel-local-prefix": FieldType.Phone,
  "tel-local-suffix": FieldType.Phone,
  "tel-country-code": FieldType.Phone,
  "street-address": FieldType.AddressLine1,
  "address-line1": FieldType.AddressLine1,
  "address-line2": FieldType.AddressLine2,
  "address-level2": FieldType.City,
  "address-level1": FieldType.State,
  "postal-code": FieldType.PostalCode,
  country: FieldType.Country,
  "country-name": FieldType.Country,
  organization: FieldType.Company,
  "organization-title": FieldType.JobTitle,
  url: FieldType.Website
}

const FIELD_TYPE_TOKENS: Record<FieldType, readonly FieldTypeToken[]> = {
  [FieldType.FirstName]: [
    { token: "first name", score: 1.2 },
    "given name",
    "forename",
    "fname",
    { token: "first", score: 0.85 }
  ],
  [FieldType.LastName]: [
    { token: "last name", score: 1.2 },
    "family name",
    "surname",
    "lname",
    { token: "last", score: 0.85 }
  ],
  [FieldType.FullName]: [
    { token: "full name", score: 1.2 },
    "your name",
    { token: "name", score: 0.5 }
  ],
  [FieldType.Email]: [
    { token: "email", score: 1.2 },
    "e mail",
    { token: "email address", score: 1.2 },
    "mail"
  ],
  [FieldType.Phone]: [
    { token: "phone", score: 1.2 },
    "phone",
    "phone number",
    { token: "mobile", score: 1.2 },
    "mobile number",
    "telephone",
    "tel"
  ],
  [FieldType.AddressLine1]: [
    "address line 1",
    "street address",
    "street",
    "address 1",
    "address1"
  ],
  [FieldType.AddressLine2]: [
    "address line 2",
    "apartment",
    "apt",
    "suite",
    "unit"
  ],
  [FieldType.City]: [
    "city",
    "town",
    "current city",
    { token: "city", score: 1.25 }
  ],
  [FieldType.State]: ["state", "province", "region"],
  [FieldType.PostalCode]: ["postal code", "postcode", "zip", "zip code"],
  [FieldType.Country]: [
    "country",
    "nation",
    "current location",
    "present location",
    { token: "location", score: 1.2 }
  ],
  [FieldType.Company]: ["company", "organization", "employer", "business"],
  [FieldType.JobTitle]: ["job title", "title", "role", "position"],
  [FieldType.CurrentCtc]: [
    "current ctc",
    "ctc",
    "current salary",
    "current package",
    "present salary",
    "current compensation"
  ],
  [FieldType.ExpectedCtc]: [
    "expected ctc",
    "expected annual compensation",
    "expected total compensation",
    "expected compensation range",
    "expected annual total compensation",
    "expected annual total compensation range",
    "annual total compensation expectation",
    "salary expectation",
    "expected salary",
    "expected package",
    "expected compensation",
    "desired salary",
    "desired ctc"
  ],
  [FieldType.NoticePeriod]: [
    "notice period",
    "notice period end",
    "notice end date",
    "last working day",
    "lwd",
    "relieving date",
    "serving notice"
  ],
  [FieldType.Resume]: [
    { token: "resume", score: 1.25 },
    { token: "cv", score: 1.25 },
    "resume cv",
    "curriculum vitae",
    "upload resume",
    "attach resume",
    "resume upload"
  ],
  [FieldType.LinkedIn]: [
    { token: "linkedin", score: 1.25 },
    { token: "linkedin url", score: 1.25 },
    { token: "linkedin profile", score: 1.25 },
    "linked in"
  ],
  [FieldType.GitHub]: [
    { token: "github", score: 1.25 },
    "github profile",
    "git hub"
  ],
  [FieldType.Website]: [
    "website",
    "portfolio",
    { token: "portfolio", score: 1.25 },
    "personal site"
  ],
  [FieldType.Unknown]: []
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export const normalizeText = (rawValue: string): string => {
  return rawValue
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

const containsToken = (normalizedText: string, token: string): boolean => {
  const pattern = new RegExp(`(^|\\s)${escapeRegExp(token)}(\\s|$)`)
  return pattern.test(normalizedText)
}

const toTokenPattern = (token: FieldTypeToken): Required<TokenPattern> => {
  if (typeof token === "string") {
    return { token, score: 1 }
  }

  return {
    token: token.token,
    score: token.score ?? 1
  }
}

export const getMatchesFromText = (rawValue: string): TextMatch[] => {
  const normalized = normalizeText(rawValue)
  if (!normalized) {
    return []
  }

  const results: TextMatch[] = []

  for (const fieldType of FIELD_TYPES) {
    if (fieldType === FieldType.Unknown) {
      continue
    }

    const tokens = FIELD_TYPE_TOKENS[fieldType]
    let strongestMatch: Required<TokenPattern> | null = null

    for (const rawToken of tokens) {
      const tokenPattern = toTokenPattern(rawToken)

      if (!containsToken(normalized, tokenPattern.token)) {
        continue
      }

      if (!strongestMatch) {
        strongestMatch = tokenPattern
        continue
      }

      if (tokenPattern.score > strongestMatch.score) {
        strongestMatch = tokenPattern
        continue
      }

      if (
        tokenPattern.score === strongestMatch.score &&
        tokenPattern.token.length > strongestMatch.token.length
      ) {
        strongestMatch = tokenPattern
      }
    }

    if (strongestMatch) {
      results.push({
        fieldType,
        score: strongestMatch.score,
        token: strongestMatch.token
      })
    }
  }

  return results
}

export const getMatchesFromAutocomplete = (rawValue: string): FieldType[] => {
  const tokens = rawValue
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
  const matches: FieldType[] = []

  for (const token of tokens) {
    const mapped = AUTOCOMPLETE_TYPE_MAP[token]
    if (mapped && !matches.includes(mapped)) {
      matches.push(mapped)
    }
  }

  return matches
}

export const isGenericText = (rawValue: string): boolean => {
  const normalized = normalizeText(rawValue)
  if (!normalized) {
    return true
  }

  const tokens = normalized.split(" ").filter(Boolean)
  if (tokens.length === 0) {
    return true
  }

  return tokens.every((token) => GENERIC_TOKENS.has(token))
}
