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
    "fname"
  ],
  [FieldType.LastName]: [
    { token: "last name", score: 1.2 },
    "family name",
    "surname",
    "lname"
  ],
  [FieldType.FullName]: [
    { token: "full name", score: 1.2 },
    { token: "first and last name", score: 1.35 },
    { token: "first last name", score: 1.3 },
    { token: "first name last name", score: 1.35 },
    { token: "name pronunciation", score: 1.15 },
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
    "phone number",
    { token: "contact number", score: 1.2 },
    { token: "contact no", score: 1.15 },
    { token: "whatsapp", score: 1.25 },
    { token: "whatsapp number", score: 1.3 },
    { token: "whats app", score: 1.25 },
    { token: "whats app number", score: 1.3 },
    { token: "mobile", score: 1.2 },
    "mobile number",
    "telephone",
    "tel"
  ],
  [FieldType.AddressLine1]: [
    "address line 1",
    "street address",
    "street",
    { token: "address", score: 0.7 },
    "address 1",
    "address1"
  ],
  [FieldType.AddressLine2]: [
    { token: "address line 2", score: 1.25 },
    "apartment",
    "apt",
    "suite",
    "unit"
  ],
  [FieldType.City]: [
    { token: "city", score: 1.25 },
    { token: "location city", score: 1.25 },
    { token: "current location", score: 1.2 },
    { token: "present location", score: 1.2 },
    { token: "work location", score: 1.2 },
    { token: "current work location", score: 1.25 },
    { token: "currently located", score: 1.2 },
    { token: "where are you currently located", score: 1.25 },
    { token: "location", score: 0.95 },
    { token: "city and state", score: 1.2 },
    "town",
    "current city"
  ],
  [FieldType.State]: [
    { token: "state", score: 1.1 },
    "province",
    { token: "region", score: 0.45 }
  ],
  [FieldType.PostalCode]: [
    "postal code",
    "postcode",
    "zip",
    "zip code",
    "pincode",
    "pin code"
  ],
  [FieldType.Country]: [
    { token: "country", score: 1.2 },
    { token: "country selector", score: 1.45 },
    { token: "nationality", score: 1.35 },
    { token: "citizenship", score: 1.25 },
    { token: "country region", score: 1.25 },
    { token: "work country", score: 1.15 },
    { token: "home country", score: 1.15 },
    "nation",
    { token: "country name", score: 1.15 }
  ],
  [FieldType.Gender]: [
    { token: "male female", score: 1.2 },
    { token: "gender", score: 1.2 },
    { token: "sex", score: 1.1 }
  ],
  [FieldType.Company]: [
    { token: "company", score: 0.55 },
    "organization",
    "employer",
    "business",
    { token: "current company", score: 1.15 },
    { token: "employer name", score: 1.15 },
    { token: "most recent company", score: 1.15 },
    { token: "current or most recent company", score: 1.2 }
  ],
  [FieldType.JobTitle]: [
    { token: "job title", score: 1.3 },
    { token: "current title", score: 1.2 },
    { token: "current role", score: 1.15 },
    { token: "current designation", score: 1.2 },
    { token: "profession", score: 1.25 },
    { token: "select profession", score: 1.3 },
    { token: "designation", score: 1.1 },
    { token: "professional title", score: 1.2 },
    { token: "position title", score: 1.2 },
    { token: "title", score: 0.65 },
    { token: "role", score: 0.2 },
    { token: "position", score: 0.2 }
  ],
  [FieldType.TotalExperience]: [
    { token: "total experience", score: 1.35 },
    { token: "total work experience", score: 1.35 },
    { token: "overall experience", score: 1.3 },
    { token: "years of experience", score: 1.25 },
    { token: "how many years of experience do you have", score: 1.45 },
    { token: "full time experience", score: 1.35 },
    { token: "years of full time experience", score: 1.45 },
    { token: "how many years of full time experience do you have", score: 1.5 },
    { token: "total years of experience", score: 1.35 },
    { token: "work experience", score: 1.15 },
    { token: "experience in years", score: 1.2 },
    { token: "professional experience", score: 1.15 }
  ],
  [FieldType.RelevantExperience]: [
    { token: "relevant experience", score: 1.35 },
    { token: "relevant years of experience", score: 1.35 },
    { token: "relevant work experience", score: 1.3 },
    { token: "experience relevant to this role", score: 1.3 },
    { token: "hands on experience", score: 0.9 },
    { token: "domain experience", score: 1.15 }
  ],
  [FieldType.Skills]: [
    { token: "technical skills", score: 1.35 },
    { token: "key skills", score: 1.3 },
    { token: "primary skills", score: 1.25 },
    { token: "core skills", score: 1.25 },
    { token: "hands on experience in", score: 1.3 },
    { token: "areas you have hands on experience in", score: 1.4 },
    { token: "select all that apply", score: 1.35 },
    { token: "check all that apply", score: 1.35 },
    { token: "choose all that apply", score: 1.35 },
    { token: "check the areas", score: 1.3 },
    { token: "skills", score: 1.05 },
    { token: "competencies", score: 1.2 }
  ],
  [FieldType.TechStack]: [
    { token: "tech stack", score: 1.4 },
    { token: "technology stack", score: 1.35 },
    { token: "stack and architecture", score: 1.35 },
    { token: "architecture you ve worked on", score: 1.35 },
    { token: "technologies worked on", score: 1.3 },
    { token: "frameworks and tools", score: 1.2 },
    { token: "architecture", score: 0.85 },
    { token: "stack", score: 0.75 }
  ],
  [FieldType.ScaleExperience]: [
    { token: "scale handling experience", score: 1.45 },
    { token: "scalability experience", score: 1.35 },
    { token: "large scale", score: 1.25 },
    { token: "millions of users", score: 1.35 },
    { token: "concurrent transactions", score: 1.3 },
    { token: "high traffic", score: 1.25 },
    { token: "system scale", score: 1.2 }
  ],
  [FieldType.ProfessionalSummary]: [
    { token: "professional summary", score: 1.4 },
    { token: "profile summary", score: 1.35 },
    { token: "tell us about yourself", score: 1.35 },
    { token: "about yourself", score: 1.2 },
    { token: "introduce yourself", score: 1.3 },
    { token: "about you", score: 1.15 },
    { token: "short bio", score: 1.2 }
  ],
  [FieldType.ProjectSummary]: [
    { token: "projects built", score: 1.35 },
    { token: "project details", score: 1.25 },
    { token: "projects from scratch", score: 1.4 },
    { token: "built from scratch", score: 1.35 },
    { token: "project challenges", score: 1.25 },
    { token: "describe your projects", score: 1.3 },
    { token: "portfolio projects", score: 1.2 },
    { token: "projects", score: 0.9 }
  ],
  [FieldType.HighestEducation]: [
    { token: "highest education", score: 1.4 },
    { token: "highest qualification", score: 1.4 },
    { token: "education qualification", score: 1.3 },
    { token: "academic qualification", score: 1.3 },
    { token: "education", score: 1.05 },
    { token: "degree", score: 1.15 },
    { token: "college", score: 0.9 },
    { token: "university", score: 0.9 }
  ],
  [FieldType.GraduationYear]: [
    { token: "graduation year", score: 1.45 },
    { token: "year of graduation", score: 1.45 },
    { token: "year of passing", score: 1.4 },
    { token: "passout year", score: 1.4 },
    { token: "graduated in", score: 1.35 },
    { token: "passing year", score: 1.35 }
  ],
  [FieldType.DateOfBirth]: [
    { token: "date of birth", score: 1.5 },
    { token: "birth date", score: 1.45 },
    { token: "dob", score: 1.4 },
    { token: "born on", score: 1.35 },
    { token: "your birthday", score: 1.25 }
  ],
  [FieldType.CurrentCtc]: [
    { token: "current ctc", score: 1.25 },
    { token: "current annual pay", score: 1.35 },
    { token: "current annual pay fixed", score: 1.45 },
    { token: "current annual pay variable", score: 1.45 },
    { token: "ctc", score: 0.45 },
    { token: "current compensation", score: 1.2 },
    { token: "current salary", score: 1.2 },
    { token: "current pay", score: 1.1 },
    "current package",
    "present salary",
    "present compensation"
  ],
  [FieldType.ExpectedCtc]: [
    { token: "expected ctc", score: 1.3 },
    { token: "expected annual pay", score: 1.4 },
    { token: "expected compensation", score: 1.3 },
    { token: "compensation for this position", score: 1.25 },
    { token: "annual salary requirement", score: 1.3 },
    { token: "salary requirement", score: 1.2 },
    { token: "salary expectations", score: 1.3 },
    { token: "desired compensation", score: 1.3 },
    { token: "compensation expectation", score: 1.25 },
    { token: "expected pay", score: 1.2 },
    "expected annual compensation",
    "expected total compensation",
    "expected compensation range",
    "expected annual total compensation",
    "expected annual total compensation range",
    "annual total compensation expectation",
    "salary expectation",
    "expected salary",
    "expected package",
    "desired salary",
    { token: "desired ctc", score: 1.2 }
  ],
  [FieldType.NoticePeriod]: [
    "notice period",
    { token: "number of days", score: 1.3 },
    { token: "notice period days", score: 1.35 },
    { token: "availability to start", score: 1.2 },
    { token: "availability", score: 0.95 },
    { token: "date of availability", score: 1.2 },
    { token: "estimated date of your availability", score: 1.25 },
    { token: "when can you start", score: 1.2 },
    { token: "when you can start", score: 1.2 },
    { token: "how soon can you start", score: 1.2 },
    { token: "how soon would you be able to start", score: 1.25 },
    { token: "start date", score: 1.2 },
    { token: "earliest start date", score: 1.25 },
    { token: "earliest joining date", score: 1.25 },
    { token: "joining date", score: 1.2 },
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
    { token: "linkedin profile url", score: 1.3 },
    "linked in"
  ],
  [FieldType.GitHub]: [
    { token: "github", score: 1.25 },
    "github profile",
    "git hub"
  ],
  [FieldType.LeetCode]: [
    { token: "leetcode", score: 1.35 },
    { token: "leetcode profile", score: 1.4 },
    { token: "coding profile", score: 1.1 },
    { token: "competitive profile", score: 1.1 }
  ],
  [FieldType.Website]: [
    "website",
    { token: "website url", score: 1.2 },
    { token: "portfolio website", score: 1.25 },
    { token: "portfolio", score: 1.25 },
    "personal site"
  ],
  [FieldType.WorkAuthorization]: [
    { token: "work authorization", score: 1.4 },
    { token: "authorized to work", score: 1.4 },
    { token: "work authorisation", score: 1.4 },
    { token: "authorised to work", score: 1.4 },
    { token: "legally authorized", score: 1.35 },
    { token: "legally authorised", score: 1.35 },
    { token: "eligible to work", score: 1.35 },
    { token: "right to work", score: 1.35 },
    { token: "work permit", score: 1.3 },
    { token: "visa sponsorship", score: 1.4 },
    { token: "require sponsorship", score: 1.35 },
    { token: "require visa sponsorship", score: 1.45 },
    { token: "need sponsorship", score: 1.35 },
    { token: "sponsorship", score: 1.15 },
    { token: "immigration sponsorship", score: 1.4 },
    { token: "do you now or in the future require sponsorship", score: 1.5 },
    { token: "will you now or in the future require sponsorship", score: 1.5 },
    { token: "employment eligibility", score: 1.3 },
    { token: "work visa", score: 1.3 },
    { token: "visa status", score: 1.25 }
  ],
  [FieldType.ReferralSource]: [
    { token: "how did you hear about", score: 1.45 },
    { token: "how did you hear", score: 1.4 },
    { token: "how did you learn about", score: 1.4 },
    { token: "how did you find out about", score: 1.4 },
    { token: "how did you find this", score: 1.35 },
    { token: "where did you hear", score: 1.35 },
    { token: "where did you learn", score: 1.35 },
    { token: "referral source", score: 1.35 },
    { token: "source of application", score: 1.3 },
    { token: "how did you find us", score: 1.3 },
    { token: "referred by", score: 1.25 },
    { token: "application source", score: 1.2 },
    { token: "source", score: 0.35 }
  ],
  [FieldType.Relocation]: [
    { token: "willing to relocate", score: 1.45 },
    { token: "open to relocating", score: 1.4 },
    { token: "open to relocation", score: 1.4 },
    { token: "able to relocate", score: 1.35 },
    { token: "relocation", score: 1.15 },
    { token: "relocate", score: 1.1 },
    { token: "open to working in person", score: 1.3 },
    { token: "open to working on site", score: 1.3 },
    { token: "work on site", score: 1.15 },
    { token: "work in office", score: 1.15 },
    { token: "comfortable commuting", score: 1.25 },
    { token: "able to commute", score: 1.2 }
  ],
  [FieldType.Pronouns]: [
    { token: "preferred pronouns", score: 1.45 },
    { token: "pronouns", score: 1.35 },
    { token: "your pronouns", score: 1.4 },
    { token: "personal pronouns", score: 1.4 }
  ],
  [FieldType.CoverLetter]: [
    { token: "cover letter", score: 1.35 },
    { token: "coverletter", score: 1.3 },
    { token: "covering letter", score: 1.3 },
    { token: "letter of motivation", score: 1.25 },
    { token: "motivation letter", score: 1.25 }
  ],
  [FieldType.PreferredName]: [
    { token: "preferred name", score: 1.3 },
    { token: "nickname", score: 1.2 },
    { token: "preferred first name", score: 1.35 },
    { token: "name you go by", score: 1.3 },
    { token: "display name", score: 1.15 }
  ],
  [FieldType.EeoGender]: [
    { token: "gender", score: 0.85 },
    { token: "gender identity", score: 1.4 },
    { token: "sex", score: 0.9 }
  ],
  [FieldType.EeoRace]: [
    { token: "race", score: 1.3 },
    { token: "ethnicity", score: 1.3 },
    { token: "race ethnicity", score: 1.4 },
    { token: "racial", score: 1.2 },
    { token: "ethnic background", score: 1.3 },
    { token: "hispanic", score: 1.2 },
    { token: "latino", score: 1.1 }
  ],
  [FieldType.EeoVeteran]: [
    { token: "veteran status", score: 1.45 },
    { token: "veteran", score: 1.3 },
    { token: "protected veteran", score: 1.4 },
    { token: "military service", score: 1.3 },
    { token: "military status", score: 1.3 }
  ],
  [FieldType.EeoDisability]: [
    { token: "disability status", score: 1.45 },
    { token: "disability", score: 1.3 },
    { token: "disabled", score: 1.2 },
    { token: "handicap", score: 1.15 }
  ],
  [FieldType.Unknown]: []
}

const COMPENSATION_TERMS = [
  "compensation",
  "salary",
  "ctc",
  "pay",
  "annual salary"
]

const EXPECTED_TERMS = [
  "expected",
  "desired",
  "expectation",
  "requirement",
  "requirements"
]

const CURRENT_COMPENSATION_TERMS = [
  "current ctc",
  "current salary",
  "current compensation",
  "current pay",
  "present salary",
  "present compensation",
  "existing salary",
  "existing compensation"
]

const LOCATION_CITY_TERMS = [
  "current location",
  "present location",
  "work location",
  "current work location",
  "location city",
  "city and state",
  "currently located",
  "where are you currently located",
  "city",
  "town"
]

const GENERIC_LOCATION_TERMS = ["location"]

const LINK_STYLE_TERMS = ["link", "url", "profile", "website", "portfolio"]

const UPLOAD_STYLE_TERMS = ["upload", "attach", "file", "drop", "browse"]

const TECH_STACK_TERMS = [
  "tech stack",
  "technology stack",
  "stack and architecture",
  "architecture you ve worked on",
  "architecture"
]

const PROJECT_TERMS = [
  "projects built",
  "project details",
  "projects from scratch",
  "built from scratch",
  "project challenges",
  "describe your projects"
]

const SCALE_TERMS = [
  "scale handling experience",
  "scalability experience",
  "large scale",
  "millions of users",
  "concurrent transactions",
  "high traffic"
]

const COUNTRY_TERMS = ["country", "nation", "country region"]

const CITY_TERMS = ["city", "town"]

const SKILL_CHECKLIST_TERMS = [
  "areas you have hands on experience in",
  "hands on experience in",
  "select all that apply",
  "check all that apply",
  "choose all that apply",
  "check the areas"
]

const WORK_AUTHORIZATION_TERMS = [
  "authorized to work",
  "authorization to work",
  "work authorization",
  "visa sponsorship",
  "require sponsorship"
]

const RELOCATION_TERMS = [
  "relocation",
  "relocate",
  "open to working in person",
  "work in person",
  "intend to work",
  "where do you intend to work"
]

const LEGAL_DISCLOSURE_TERMS = [
  "consent",
  "gdpr",
  "privacy notice",
  "terms and conditions",
  "terms of service",
  "privacy policy",
  "acknowledge",
  "government official",
  "outside business activities",
  "bound by any agreements",
  "non compete",
  "non solicitation",
  "intellectual property ownership",
  "legally eligible",
  "legally authorized",
  "work authorization",
  "require sponsorship",
  "retain or extend your work authorization",
  "have you ever worked for"
]

const SOURCE_ATTRIBUTION_TERMS = [
  "how did you first hear",
  "how did you first learn",
  "where did you hear about",
  "how did you hear about",
  "how did you learn about"
]

const BOOLEAN_LOCATION_TERMS = [
  "are you currently located in",
  "are you located in"
]

const EMPLOYMENT_TYPE_TERMS = [
  "full time or part time position",
  "full time or part time",
  "full time position",
  "part time position"
]

const TOTAL_EXPERIENCE_QUESTION_TERMS = [
  "how many years of experience do you have",
  "how many years of full time experience do you have",
  "years of full time experience",
  "full time experience"
]

const JOB_TITLE_EXPLICIT_TERMS = [
  "job title",
  "position title",
  "current title",
  "professional title",
  "current designation"
]

const ROLE_REFERENCE_TERMS = [
  "this role",
  "the role",
  "your role",
  "this position",
  "the position",
  "position you are applying for",
  "essential functions of this role",
  "related to the requirements of the position"
]

const MOTIVATION_ESSAY_TERMS = [
  "why would you like to work with us",
  "why do you want to work with us",
  "why are you interested in this role",
  "why are you interested in working at",
  "why this role",
  "what motivates you"
]

const COMBINED_NAME_TERMS = [
  "first and last name",
  "first name and last name",
  "first last name"
]

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export const normalizeText = (rawValue: string): string => {
  const withWordBoundaries = rawValue
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")

  return withWordBoundaries
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

const containsPhrase = (normalizedText: string, phrase: string): boolean =>
  containsToken(normalizedText, phrase)

const containsAnyPhrase = (
  normalizedText: string,
  phrases: readonly string[]
): boolean => phrases.some((phrase) => containsPhrase(normalizedText, phrase))

const applyContextAdjustments = (
  normalizedText: string,
  matches: TextMatch[]
): TextMatch[] => {
  const byFieldType = new Map<FieldType, TextMatch>()

  for (const match of matches) {
    byFieldType.set(match.fieldType, { ...match })
  }

  const dampen = (fieldType: FieldType, factor: number) => {
    const match = byFieldType.get(fieldType)
    if (!match) {
      return
    }

    match.score = Number((match.score * factor).toFixed(4))
    byFieldType.set(fieldType, match)
  }

  const hasCompensationIntent = containsAnyPhrase(normalizedText, COMPENSATION_TERMS)
  const hasExpectedIntent = containsAnyPhrase(normalizedText, EXPECTED_TERMS)
  const hasCurrentCompensationIntent = containsAnyPhrase(
    normalizedText,
    CURRENT_COMPENSATION_TERMS
  )
  const hasCityLocationIntent = containsAnyPhrase(normalizedText, LOCATION_CITY_TERMS)
  const hasGenericLocationIntent = containsAnyPhrase(
    normalizedText,
    GENERIC_LOCATION_TERMS
  )
  const hasLinkStyleIntent = containsAnyPhrase(normalizedText, LINK_STYLE_TERMS)
  const hasUploadStyleIntent = containsAnyPhrase(normalizedText, UPLOAD_STYLE_TERMS)
  const hasTechStackIntent = containsAnyPhrase(normalizedText, TECH_STACK_TERMS)
  const hasProjectIntent = containsAnyPhrase(normalizedText, PROJECT_TERMS)
  const hasScaleIntent = containsAnyPhrase(normalizedText, SCALE_TERMS)
  const hasSkillChecklistIntent = containsAnyPhrase(
    normalizedText,
    SKILL_CHECKLIST_TERMS
  )
  const hasCountryIntent = containsAnyPhrase(normalizedText, COUNTRY_TERMS)
  const hasExplicitCityIntent = containsAnyPhrase(normalizedText, CITY_TERMS)
  const hasWorkAuthorizationIntent = containsAnyPhrase(
    normalizedText,
    WORK_AUTHORIZATION_TERMS
  )
  const hasRelocationIntent = containsAnyPhrase(normalizedText, RELOCATION_TERMS)
  const hasLegalDisclosureIntent = containsAnyPhrase(
    normalizedText,
    LEGAL_DISCLOSURE_TERMS
  )
  const hasSourceAttributionIntent = containsAnyPhrase(
    normalizedText,
    SOURCE_ATTRIBUTION_TERMS
  )
  const hasBooleanLocationIntent = containsAnyPhrase(
    normalizedText,
    BOOLEAN_LOCATION_TERMS
  )
  const hasEmploymentTypeIntent = containsAnyPhrase(
    normalizedText,
    EMPLOYMENT_TYPE_TERMS
  )
  const hasTotalExperienceQuestionIntent = containsAnyPhrase(
    normalizedText,
    TOTAL_EXPERIENCE_QUESTION_TERMS
  )
  const hasRoleReferenceIntent = containsAnyPhrase(
    normalizedText,
    ROLE_REFERENCE_TERMS
  )
  const hasExplicitJobTitleIntent = containsAnyPhrase(
    normalizedText,
    JOB_TITLE_EXPLICIT_TERMS
  )
  const hasMotivationEssayIntent = containsAnyPhrase(
    normalizedText,
    MOTIVATION_ESSAY_TERMS
  )
  const hasCombinedNameIntent = containsAnyPhrase(normalizedText, COMBINED_NAME_TERMS)

  if (hasCombinedNameIntent) {
    const fullNameMatch = byFieldType.get(FieldType.FullName)
    byFieldType.set(FieldType.FullName, {
      fieldType: FieldType.FullName,
      score: Math.max(fullNameMatch?.score ?? 0, 1.35),
      token: fullNameMatch?.token ?? "first and last name"
    })

    dampen(FieldType.FirstName, 0.2)
    dampen(FieldType.LastName, 0.2)
  }

  if (hasCompensationIntent) {
    const jobTitleMatch = byFieldType.get(FieldType.JobTitle)

    if (
      jobTitleMatch &&
      (jobTitleMatch.token === "position" ||
        jobTitleMatch.token === "title" ||
        jobTitleMatch.token === "role")
    ) {
      jobTitleMatch.score = Number((jobTitleMatch.score * 0.35).toFixed(4))
      byFieldType.set(FieldType.JobTitle, jobTitleMatch)
    }
  }

  if (hasCompensationIntent && hasExpectedIntent) {
    const expectedMatch = byFieldType.get(FieldType.ExpectedCtc)
    const boostedScore = Math.max(expectedMatch?.score ?? 0, 1.35)
    byFieldType.set(FieldType.ExpectedCtc, {
      fieldType: FieldType.ExpectedCtc,
      score: boostedScore,
      token: expectedMatch?.token ?? "expected compensation"
    })

    if (!hasCurrentCompensationIntent) {
      const currentMatch = byFieldType.get(FieldType.CurrentCtc)
      if (currentMatch) {
        currentMatch.score = Number((currentMatch.score * 0.4).toFixed(4))
        byFieldType.set(FieldType.CurrentCtc, currentMatch)
      }
    }
  }

  if (hasCompensationIntent && hasCurrentCompensationIntent) {
    const currentMatch = byFieldType.get(FieldType.CurrentCtc)
    const boostedScore = Math.max(currentMatch?.score ?? 0, 1.3)
    byFieldType.set(FieldType.CurrentCtc, {
      fieldType: FieldType.CurrentCtc,
      score: boostedScore,
      token: currentMatch?.token ?? "current compensation"
    })

    if (!hasExpectedIntent) {
      const expectedMatch = byFieldType.get(FieldType.ExpectedCtc)
      if (expectedMatch) {
        expectedMatch.score = Number((expectedMatch.score * 0.4).toFixed(4))
        byFieldType.set(FieldType.ExpectedCtc, expectedMatch)
      }
    }
  }

  if (hasCityLocationIntent) {
    const cityMatch = byFieldType.get(FieldType.City)
    const boostedScore = hasCountryIntent && !hasExplicitCityIntent
      ? Math.min(Math.max(cityMatch?.score ?? 0, 0.95), 1.05)
      : Math.max(cityMatch?.score ?? 0, 1.3)
    byFieldType.set(FieldType.City, {
      fieldType: FieldType.City,
      score: boostedScore,
      token: cityMatch?.token ?? "current location"
    })

    const countryMatch = byFieldType.get(FieldType.Country)
    if (countryMatch) {
      if (hasCountryIntent && !hasExplicitCityIntent) {
        countryMatch.score = Math.max(countryMatch.score, 1.25)
      } else {
        countryMatch.score = Number((countryMatch.score * 0.55).toFixed(4))
      }
      byFieldType.set(FieldType.Country, countryMatch)
    }
  }

  if (!hasCityLocationIntent && hasGenericLocationIntent) {
    const cityMatch = byFieldType.get(FieldType.City)

    if (cityMatch) {
      cityMatch.score = Math.max(cityMatch.score, 1.05)
      byFieldType.set(FieldType.City, cityMatch)
    }
  }

  if (hasLinkStyleIntent && !hasUploadStyleIntent) {
    const resumeMatch = byFieldType.get(FieldType.Resume)
    const linkedinMatch = byFieldType.get(FieldType.LinkedIn)
    const websiteMatch = byFieldType.get(FieldType.Website)
    const githubMatch = byFieldType.get(FieldType.GitHub)
    const leetCodeMatch = byFieldType.get(FieldType.LeetCode)

    if (resumeMatch && (linkedinMatch || websiteMatch || githubMatch || leetCodeMatch)) {
      resumeMatch.score = Number((resumeMatch.score * 0.3).toFixed(4))
      byFieldType.set(FieldType.Resume, resumeMatch)
    }

    if (linkedinMatch) {
      linkedinMatch.score = Math.max(linkedinMatch.score, 1.3)
      byFieldType.set(FieldType.LinkedIn, linkedinMatch)
    }
  }

  if (hasTechStackIntent) {
    const techStackMatch = byFieldType.get(FieldType.TechStack)
    byFieldType.set(FieldType.TechStack, {
      fieldType: FieldType.TechStack,
      score: Math.max(techStackMatch?.score ?? 0, 1.4),
      token: techStackMatch?.token ?? "tech stack"
    })

    const skillsMatch = byFieldType.get(FieldType.Skills)
    if (skillsMatch) {
      skillsMatch.score = Number((skillsMatch.score * 0.65).toFixed(4))
      byFieldType.set(FieldType.Skills, skillsMatch)
    }
  }

  if (hasProjectIntent) {
    const projectMatch = byFieldType.get(FieldType.ProjectSummary)
    byFieldType.set(FieldType.ProjectSummary, {
      fieldType: FieldType.ProjectSummary,
      score: Math.max(projectMatch?.score ?? 0, 1.35),
      token: projectMatch?.token ?? "projects built"
    })

    const addressLine1Match = byFieldType.get(FieldType.AddressLine1)
    if (addressLine1Match) {
      addressLine1Match.score = Number((addressLine1Match.score * 0.25).toFixed(4))
      byFieldType.set(FieldType.AddressLine1, addressLine1Match)
    }
  }

  if (hasScaleIntent) {
    const scaleMatch = byFieldType.get(FieldType.ScaleExperience)
    byFieldType.set(FieldType.ScaleExperience, {
      fieldType: FieldType.ScaleExperience,
      score: Math.max(scaleMatch?.score ?? 0, 1.4),
      token: scaleMatch?.token ?? "scale handling experience"
    })
  }

  if (hasSkillChecklistIntent) {
    const skillsMatch = byFieldType.get(FieldType.Skills)
    byFieldType.set(FieldType.Skills, {
      fieldType: FieldType.Skills,
      score: Math.max(skillsMatch?.score ?? 0, 1.4),
      token: skillsMatch?.token ?? "hands on experience in"
    })

    const relevantExperienceMatch = byFieldType.get(FieldType.RelevantExperience)
    if (relevantExperienceMatch) {
      relevantExperienceMatch.score = Number(
        (relevantExperienceMatch.score * 0.55).toFixed(4)
      )
      byFieldType.set(FieldType.RelevantExperience, relevantExperienceMatch)
    }
  }

  if (hasTotalExperienceQuestionIntent) {
    const totalExperienceMatch = byFieldType.get(FieldType.TotalExperience)
    byFieldType.set(FieldType.TotalExperience, {
      fieldType: FieldType.TotalExperience,
      score: Math.max(totalExperienceMatch?.score ?? 0, 1.45),
      token: totalExperienceMatch?.token ?? "how many years of experience do you have"
    })

    const relevantExperienceMatch = byFieldType.get(FieldType.RelevantExperience)
    if (relevantExperienceMatch) {
      relevantExperienceMatch.score = Number(
        (relevantExperienceMatch.score * 0.6).toFixed(4)
      )
      byFieldType.set(FieldType.RelevantExperience, relevantExperienceMatch)
    }
  }

  if (hasUploadStyleIntent) {
    const resumeMatch = byFieldType.get(FieldType.Resume)

    if (resumeMatch) {
      resumeMatch.score = Math.max(resumeMatch.score, 1.35)
      byFieldType.set(FieldType.Resume, resumeMatch)
    }
  }

  if (hasWorkAuthorizationIntent) {
    dampen(FieldType.Country, 0.1)
    dampen(FieldType.City, 0.1)
    dampen(FieldType.Company, 0.1)
  }

  if (hasRelocationIntent) {
    dampen(FieldType.JobTitle, 0.2)
  }

  if (hasLegalDisclosureIntent) {
    dampen(FieldType.Company, 0.1)
    dampen(FieldType.Country, 0.1)
    dampen(FieldType.City, 0.1)
    dampen(FieldType.FirstName, 0.1)
    dampen(FieldType.LastName, 0.1)
    dampen(FieldType.FullName, 0.1)
    dampen(FieldType.JobTitle, 0.1)
    dampen(FieldType.DateOfBirth, 0.1)
    dampen(FieldType.CurrentCtc, 0.1)
    dampen(FieldType.ExpectedCtc, 0.1)
  }

  if (hasSourceAttributionIntent) {
    dampen(FieldType.Company, 0.1)
    dampen(FieldType.FirstName, 0.1)
    dampen(FieldType.LastName, 0.1)
    dampen(FieldType.FullName, 0.1)
    dampen(FieldType.JobTitle, 0.1)
    dampen(FieldType.City, 0.2)
    dampen(FieldType.Country, 0.2)
  }

  if (hasMotivationEssayIntent) {
    dampen(FieldType.JobTitle, 0.1)
    dampen(FieldType.City, 0.1)
    dampen(FieldType.Country, 0.1)
    dampen(FieldType.Company, 0.1)
  }

  if (hasBooleanLocationIntent && !hasExplicitCityIntent) {
    dampen(FieldType.City, 0.1)
    dampen(FieldType.Country, 0.1)
  }

  if (hasEmploymentTypeIntent) {
    dampen(FieldType.JobTitle, 0.1)
  }

  if (hasRoleReferenceIntent && !hasExplicitJobTitleIntent) {
    dampen(FieldType.JobTitle, 0.1)
  }

  return Array.from(byFieldType.values())
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

  return applyContextAdjustments(normalized, results)
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
