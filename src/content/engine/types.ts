import type { AutofillProfile } from '../../shared/profile';

export type FillMode = 'test' | 'profile';

export type FillableKind =
  | 'input'
  | 'textarea'
  | 'select'
  | 'editable'
  | 'combobox'
  | 'listbox';

export type FillableElement =
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement
  | HTMLElement;

export interface FillableField {
  element: FillableElement;
  kind: FillableKind;
}

export interface FillSummary {
  total: number;
  filled: number;
  skipped: number;
  errors: number;
  fileInputsDetected: number;
  fileInputsAutoAttached: number;
  fileInputAttachErrors: number;
  fileInputPrompted: boolean;
}

export type FieldErrorLogger = (
  element: FillableElement,
  error: unknown
) => void;

export interface FillExecutionOptions {
  mode?: FillMode;
  profile?: AutofillProfile;
  onFieldError?: FieldErrorLogger;
  promptResumeUpload?: boolean;
}

export type ProfileFieldKey =
  | 'fullName'
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'headline'
  | 'mobile'
  | 'mobileCountryCode'
  | 'mobileLocalNumber'
  | 'email'
  | 'gender'
  | 'totalExperience'
  | 'experienceYears'
  | 'experienceMonths'
  | 'expectedSalary'
  | 'currentSalary'
  | 'preferredLocation'
  | 'currentLocation'
  | 'nationality'
  | 'noticePeriod'
  | 'noticePeriodDays'
  | 'servingNoticePeriod'
  | 'earliestJoinDays'
  | 'sourcePlatform'
  | 'lastWorkingDay'
  | 'currentCompany'
  | 'currentDesignation'
  | 'highestQualification'
  | 'degree'
  | 'collegeName'
  | 'graduationYear'
  | 'cgpa'
  | 'professionalSummary'
  | 'certifications'
  | 'frontendSkills'
  | 'backendSkills'
  | 'devopsSkills'
  | 'cloudSkills'
  | 'aiSkills'
  | 'github'
  | 'linkedin'
  | 'portfolio'
  | 'projectLinks'
  | 'leetcode'
  | 'demoVideos'
  | 'skills'
  | 'resumeFileName'
  | 'captcha';
