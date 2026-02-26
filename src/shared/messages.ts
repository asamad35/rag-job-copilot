import type { FillSummary } from '../content/formEngine';

export type PopupMessage =
  | { type: 'GET_FORM_STATUS' }
  | { type: 'FILL_WITH_TEST' }
  | { type: 'FILL_WITH_PROFILE'; promptResumeUpload?: boolean };

export interface FormStatusResponse {
  count: number;
  fileInputs: number;
}

export interface FillResponse {
  count: number;
  fileInputs: number;
  result: FillSummary;
}
