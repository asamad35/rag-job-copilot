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
  Gender = "gender",
  Company = "company",
  JobTitle = "job_title",
  TotalExperience = "total_experience",
  RelevantExperience = "relevant_experience",
  Skills = "skills",
  TechStack = "tech_stack",
  ScaleExperience = "scale_experience",
  ProfessionalSummary = "professional_summary",
  ProjectSummary = "project_summary",
  HighestEducation = "highest_education",
  GraduationYear = "graduation_year",
  DateOfBirth = "date_of_birth",
  CurrentCtc = "current_ctc",
  ExpectedCtc = "expected_ctc",
  NoticePeriod = "notice_period",
  Resume = "resume",
  LinkedIn = "linkedin",
  GitHub = "github",
  LeetCode = "leetcode",
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
  resolutionLayer: ResolutionLayer
  layer2Match?: Layer2Match
}

export type AutofillValue = string | boolean | string[]

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
  resolutionLayer: ResolutionLayer
  layer2Match?: Layer2MatchSnapshot
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
  FieldType.Gender,
  FieldType.Company,
  FieldType.JobTitle,
  FieldType.TotalExperience,
  FieldType.RelevantExperience,
  FieldType.Skills,
  FieldType.TechStack,
  FieldType.ScaleExperience,
  FieldType.ProfessionalSummary,
  FieldType.ProjectSummary,
  FieldType.HighestEducation,
  FieldType.GraduationYear,
  FieldType.DateOfBirth,
  FieldType.CurrentCtc,
  FieldType.ExpectedCtc,
  FieldType.NoticePeriod,
  FieldType.Resume,
  FieldType.LinkedIn,
  FieldType.GitHub,
  FieldType.LeetCode,
  FieldType.Website,
  FieldType.Unknown
]

export type ResolutionLayer = "layer1" | "layer2"

export interface LabelLikeCandidate {
  textNode: Text
  element: HTMLElement
  text: string
  normalizedText: string
  tagName: string
  textLength: number
}

export interface Layer2Match {
  fieldId: string
  candidateText: string
  lcaDistance: number
  sameGroup: boolean
  lexicalTopType: FieldType
  lexicalScore: number
  combinedScore: number
}

export interface Layer2MatchSnapshot {
  candidateText: string
  lcaDistance: number
  sameGroup: boolean
  lexicalTopType: FieldType
  lexicalScore: number
  combinedScore: number
}

export interface Layer2Decision {
  fieldId: string
  fieldType: FieldType
  confidence: number
  status: LayerStatus
  typeScores: Record<FieldType, number>
  match?: Layer2Match
}
