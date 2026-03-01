import { FieldType } from "~src/content/autofill/types"

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  [FieldType.FirstName]: "First Name",
  [FieldType.LastName]: "Last Name",
  [FieldType.FullName]: "Full Name",
  [FieldType.Email]: "Email",
  [FieldType.Phone]: "Phone",
  [FieldType.AddressLine1]: "Address Line 1",
  [FieldType.AddressLine2]: "Address Line 2",
  [FieldType.City]: "City",
  [FieldType.State]: "State",
  [FieldType.PostalCode]: "Postal Code",
  [FieldType.Country]: "Country",
  [FieldType.Gender]: "Gender",
  [FieldType.Company]: "Company",
  [FieldType.JobTitle]: "Job Title",
  [FieldType.TotalExperience]: "Total Experience",
  [FieldType.RelevantExperience]: "Relevant Experience",
  [FieldType.Skills]: "Skills",
  [FieldType.TechStack]: "Tech Stack",
  [FieldType.ScaleExperience]: "Scale Experience",
  [FieldType.ProfessionalSummary]: "Professional Summary",
  [FieldType.ProjectSummary]: "Project Summary",
  [FieldType.HighestEducation]: "Highest Education",
  [FieldType.GraduationYear]: "Graduation Year",
  [FieldType.DateOfBirth]: "Date Of Birth",
  [FieldType.CurrentCtc]: "Current CTC",
  [FieldType.ExpectedCtc]: "Expected CTC",
  [FieldType.NoticePeriod]: "Notice Period",
  [FieldType.Resume]: "Resume",
  [FieldType.LinkedIn]: "LinkedIn",
  [FieldType.GitHub]: "GitHub",
  [FieldType.LeetCode]: "LeetCode",
  [FieldType.Website]: "Website",
  [FieldType.Unknown]: "Unknown"
}

export const getFieldTypeLabel = (fieldType: FieldType): string =>
  FIELD_TYPE_LABELS[fieldType] ?? "Unknown"
