export enum FieldType {
  FirstName = "first_name",
  LastName = "last_name",
  FullName = "full_name",
  Email = "email",
  Phone = "phone",
  AddressLine1 = "address_line1",
  AddressLine2 = "address_line2",
  City = "city",
  State = "state",
  PostalCode = "postal_code",
  Country = "country",
  Company = "company",
  JobTitle = "job_title",
  CurrentCtc = "current_ctc",
  ExpectedCtc = "expected_ctc",
  NoticePeriod = "notice_period",
  Resume = "resume",
  LinkedIn = "linkedin",
  GitHub = "github",
  Website = "website",
  Unknown = "unknown"
}

export enum LayerStatus {
  Resolved = "resolved",
  Ambiguous = "ambiguous",
  Unresolved = "unresolved"
}

export enum SignalType {
  LabelFor = "label_for",
  LabelWrap = "label_wrap",
  AriaLabelledBy = "aria_labelledby",
  Autocomplete = "autocomplete",
  AriaLabel = "aria_label",
  Name = "name",
  Id = "id",
  Placeholder = "placeholder"
}

export enum ControlKind {
  Textual = "textual",
  Choice = "choice",
  Boolean = "boolean",
  File = "file",
  Custom = "custom"
}

export type NativeFieldElement =
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement

export type FieldElement = NativeFieldElement | HTMLElement

export interface Evidence {
  signal: SignalType
  rawValue: string
  matchedType: FieldType
  weight: number
}

export type ExtractedSignals = Record<SignalType, string[]>

export interface DiscoveredField {
  id: string
  element: FieldElement
  controlKind: ControlKind
  fillable: boolean
  skipReason?: string
}

export interface ScoredLayer1Field {
  fieldType: FieldType
  confidence: number
  status: LayerStatus
  evidence: Evidence[]
  typeScores: Record<FieldType, number>
}

export interface Layer1Result extends ScoredLayer1Field {
  fieldId: string
  element: FieldElement
  controlKind: ControlKind
  fillable: boolean
  skipReason?: string
  signals: ExtractedSignals
}

export type AutofillValue = string | boolean

export type AutofillProfile = Partial<Record<FieldType, AutofillValue>>

export interface FillActionResult {
  fieldId: string
  fieldType: FieldType
  filled: boolean
  reason?: string
}

export interface Layer1RunOptions {
  debug?: boolean
}

export interface Layer1RunSummary {
  totalDiscovered: number
  resolved: number
  ambiguous: number
  unresolved: number
  filled: number
  skipped: number
  results: Layer1Result[]
  fillActions: FillActionResult[]
}

export interface Layer1ResultSnapshot {
  fieldId: string
  fieldName: string
  controlKind: ControlKind
  fieldType: FieldType
  confidence: number
  status: LayerStatus
  fillable: boolean
  skipReason?: string
  evidence: Evidence[]
}

export interface Layer1RunSnapshot {
  totalDiscovered: number
  resolved: number
  ambiguous: number
  unresolved: number
  filled: number
  skipped: number
  results: Layer1ResultSnapshot[]
  fillActions: FillActionResult[]
}

export const SIGNAL_TYPES: readonly SignalType[] = [
  SignalType.LabelFor,
  SignalType.LabelWrap,
  SignalType.AriaLabelledBy,
  SignalType.Autocomplete,
  SignalType.AriaLabel,
  SignalType.Name,
  SignalType.Id,
  SignalType.Placeholder
]

export const FIELD_TYPES: readonly FieldType[] = [
  FieldType.FirstName,
  FieldType.LastName,
  FieldType.FullName,
  FieldType.Email,
  FieldType.Phone,
  FieldType.AddressLine1,
  FieldType.AddressLine2,
  FieldType.City,
  FieldType.State,
  FieldType.PostalCode,
  FieldType.Country,
  FieldType.Company,
  FieldType.JobTitle,
  FieldType.CurrentCtc,
  FieldType.ExpectedCtc,
  FieldType.NoticePeriod,
  FieldType.Resume,
  FieldType.LinkedIn,
  FieldType.GitHub,
  FieldType.Website,
  FieldType.Unknown
]
