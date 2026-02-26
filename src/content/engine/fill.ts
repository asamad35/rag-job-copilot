import { DEFAULT_PROFILE, type AutofillProfile } from '../../shared/profile';
import {
  PLACEHOLDER_PREFIXES,
  TEST_TEXT_VALUE,
  TEXT_INPUT_TYPES
} from './constants';
import {
  detectFillableFields,
  detectUploadInputs,
  isFillableRadio,
  promptResumeUpload
} from './detect';
import {
  emitFieldEvents,
  isVisibleEnough,
  setChecked,
  setInputValue,
  setSelectValue,
  setTextareaValue
} from './dom';
import { collectHints, isLikelyCaptchaHint, shouldIgnoreElement } from './hints';
import {
  chooseRadioCandidate,
  inferProfileFieldKey,
  pickMatchingRoleOption,
  pickMatchingSelectOption,
  profileValueByKey,
  resolveProfileOptionTargets,
  resolveProfileValueForElement
} from './profile-mapper';
import type {
  FillExecutionOptions,
  FillMode,
  FillSummary,
  ProfileFieldKey
} from './types';
import { escapeForSelector, splitMobileNumber } from './utils';

function radioGroupKey(input: HTMLInputElement): string | null {
  if (!input.name) {
    return null;
  }

  const scope = input.form?.id || 'document';
  return `${scope}::${input.name}`;
}

function pickNonPlaceholderOption(
  select: HTMLSelectElement
): HTMLOptionElement | undefined {
  const enabledOptions = Array.from(select.options).filter(
    (option) => !option.disabled
  );

  const preferred = enabledOptions.find((option) => {
    const value = option.value.trim();
    const label = option.textContent?.trim().toLowerCase() ?? '';

    if (!value) {
      return false;
    }

    return !PLACEHOLDER_PREFIXES.some((prefix) => label.startsWith(prefix));
  });

  if (preferred) {
    return preferred;
  }

  return enabledOptions.find((option) => option.value.trim().length > 0);
}

function resolveDefaultValueForInputType(type: string): string {
  if (TEXT_INPUT_TYPES.has(type)) {
    return TEST_TEXT_VALUE;
  }

  switch (type) {
    case 'number':
      return '1';
    case 'date':
      return '2026-01-01';
    case 'datetime-local':
      return '2026-01-01T10:00';
    case 'month':
      return '2026-01';
    case 'time':
      return '10:00';
    case 'week':
      return '2026-W01';
    case 'color':
      return '#000000';
    case 'range':
      return '50';
    default:
      return TEST_TEXT_VALUE;
  }
}

function resolveRangeValue(input: HTMLInputElement): string {
  const min = Number.parseFloat(input.min);
  const max = Number.parseFloat(input.max);
  if (Number.isFinite(min) && Number.isFinite(max)) {
    return ((min + max) / 2).toString();
  }

  return '50';
}

function fillInput(
  input: HTMLInputElement,
  seenRadioGroups: Set<string>,
  mode: FillMode,
  profile: AutofillProfile
): boolean {
  const type = input.type.toLowerCase();
  const hint = collectHints(input);
  if (isLikelyCaptchaHint(hint)) {
    return false;
  }

  if (type === 'checkbox') {
    setChecked(input, true);
    emitFieldEvents(input);
    return true;
  }

  if (type === 'radio') {
    if (!input.name) {
      setChecked(input, true);
      emitFieldEvents(input);
      return true;
    }

    const groupId = radioGroupKey(input);
    if (groupId && seenRadioGroups.has(groupId)) {
      return false;
    }

    const scope: ParentNode = input.form ?? input.ownerDocument;
    const selector = `input[type="radio"][name="${escapeForSelector(input.name)}"]`;
    const candidates = Array.from(scope.querySelectorAll(selector)).filter(
      (element): element is HTMLInputElement =>
        element instanceof HTMLInputElement && isFillableRadio(element)
    );

    if (!candidates.length) {
      if (groupId) {
        seenRadioGroups.add(groupId);
      }
      return false;
    }

    let key: ProfileFieldKey | null = null;
    if (mode === 'profile') {
      key = inferProfileFieldKey(input, hint);
    }

    const candidate = chooseRadioCandidate(candidates, key, profile);
    if (!candidate) {
      if (groupId) {
        seenRadioGroups.add(groupId);
      }
      return false;
    }

    setChecked(candidate, true);
    emitFieldEvents(candidate);
    if (groupId) {
      seenRadioGroups.add(groupId);
    }

    return true;
  }

  if (type === 'range') {
    setInputValue(input, resolveRangeValue(input));
    emitFieldEvents(input);
    return true;
  }

  const fallbackValue = resolveDefaultValueForInputType(type);
  let valueToSet = fallbackValue;

  if (mode === 'profile') {
    const profileValue = resolveProfileValueForElement(input, profile, fallbackValue);
    if (profileValue.shouldSkip) {
      return false;
    }

    valueToSet = profileValue.value;

    if (type === 'number') {
      const numericValue = valueToSet.replace(/[^0-9.\-]+/g, '').trim();
      valueToSet = numericValue || fallbackValue;
    }

    if (profileValue.key === 'mobileLocalNumber') {
      valueToSet = splitMobileNumber(profile.mobile).localNumber || valueToSet;
    }

    if (profileValue.key === 'mobileCountryCode') {
      valueToSet = splitMobileNumber(profile.mobile).countryCode || valueToSet;
    }

    if (
      type === 'text' &&
      (profileValue.key === 'github' ||
        profileValue.key === 'portfolio' ||
        profileValue.key === 'linkedin' ||
        profileValue.key === 'projectLinks' ||
        profileValue.key === 'leetcode' ||
        profileValue.key === 'demoVideos')
    ) {
      if (!valueToSet) {
        return false;
      }
    }
  }

  if (type === 'url') {
    if (!valueToSet.startsWith('http://') && !valueToSet.startsWith('https://')) {
      if (mode === 'profile') {
        return false;
      }

      valueToSet = 'https://example.com';
    }
  }

  setInputValue(input, valueToSet);
  emitFieldEvents(input);
  return true;
}

function fillTextarea(
  textarea: HTMLTextAreaElement,
  mode: FillMode,
  profile: AutofillProfile
): boolean {
  if (isLikelyCaptchaHint(collectHints(textarea))) {
    return false;
  }

  const fallbackValue = TEST_TEXT_VALUE;
  let valueToSet = fallbackValue;

  if (mode === 'profile') {
    const profileValue = resolveProfileValueForElement(textarea, profile, fallbackValue);
    if (profileValue.shouldSkip) {
      return false;
    }

    valueToSet = profileValue.value;
  }

  setTextareaValue(textarea, valueToSet);
  emitFieldEvents(textarea);
  return true;
}

function fillSelect(
  select: HTMLSelectElement,
  mode: FillMode,
  profile: AutofillProfile
): boolean {
  if (shouldIgnoreElement(select)) {
    return false;
  }

  if (mode === 'profile') {
    const hint = collectHints(select);
    const key = inferProfileFieldKey(select, hint);
    if (key) {
      const targets = resolveProfileOptionTargets(key, profile);
      const matched = pickMatchingSelectOption(select, targets);
      if (matched) {
        setSelectValue(select, matched.value);
        emitFieldEvents(select);
        return true;
      }
    }
  }

  const candidate = pickNonPlaceholderOption(select);
  if (!candidate) {
    return false;
  }

  setSelectValue(select, candidate.value);
  emitFieldEvents(select);
  return true;
}

function fillEditable(
  element: HTMLElement,
  mode: FillMode,
  profile: AutofillProfile
): boolean {
  if (shouldIgnoreElement(element)) {
    return false;
  }

  const fallbackValue = TEST_TEXT_VALUE;
  let valueToSet = fallbackValue;

  if (mode === 'profile') {
    const profileValue = resolveProfileValueForElement(element, profile, fallbackValue);
    if (profileValue.shouldSkip) {
      return false;
    }

    valueToSet = profileValue.value;
  }

  element.textContent = valueToSet;
  emitFieldEvents(element);
  return true;
}

function fillComboboxLike(
  element: HTMLElement,
  mode: FillMode,
  profile: AutofillProfile
): boolean {
  if (shouldIgnoreElement(element)) {
    return false;
  }

  const fallbackValue = TEST_TEXT_VALUE;
  const hint = collectHints(element);
  const key = mode === 'profile' ? inferProfileFieldKey(element, hint) : null;
  if (key === 'captcha') {
    return false;
  }

  const resolvedValue =
    mode === 'profile' && key
      ? profileValueByKey(key, profile) || fallbackValue
      : fallbackValue;

  const textbox = element.querySelector(
    'input:not([type="hidden"]):not([type="file"]):not([readonly]), textarea:not([readonly]), [contenteditable="true"], [role="textbox"]:not([aria-readonly="true"])'
  );

  if (textbox instanceof HTMLInputElement) {
    setInputValue(textbox, resolvedValue);
    emitFieldEvents(textbox);
  } else if (textbox instanceof HTMLTextAreaElement) {
    setTextareaValue(textbox, resolvedValue);
    emitFieldEvents(textbox);
  } else if (textbox instanceof HTMLElement) {
    textbox.textContent = resolvedValue;
    emitFieldEvents(textbox);
  } else {
    element.textContent = resolvedValue;
    emitFieldEvents(element);
  }

  let optionsRoot: ParentNode = document;
  const controlledListId = element.getAttribute('aria-controls') ?? '';
  if (controlledListId) {
    const controlled = document.getElementById(controlledListId);
    if (controlled) {
      optionsRoot = controlled;
    }
  }

  const optionElements = Array.from(optionsRoot.querySelectorAll('[role="option"]')).filter(
    (node): node is HTMLElement =>
      node instanceof HTMLElement &&
      isVisibleEnough(node) &&
      node.getAttribute('aria-disabled') !== 'true' &&
      !node.hasAttribute('disabled')
  );

  if (!optionElements.length) {
    return true;
  }

  const targets = key ? resolveProfileOptionTargets(key, profile) : [];
  const option = pickMatchingRoleOption(optionElements, targets);
  if (!option) {
    return true;
  }

  option.click();
  emitFieldEvents(option);
  return true;
}

export function fillDetectedFields(
  root: ParentNode = document,
  options: FillExecutionOptions = {}
): FillSummary {
  const mode = options.mode ?? 'test';
  const profile = options.profile ?? DEFAULT_PROFILE;
  const fields = detectFillableFields(root);
  const seenRadioGroups = new Set<string>();

  const summary: FillSummary = {
    total: fields.length,
    filled: 0,
    skipped: 0,
    errors: 0,
    fileInputsDetected: detectUploadInputs(root).length,
    fileInputsAutoAttached: 0,
    fileInputAttachErrors: 0,
    fileInputPrompted: false
  };

  for (const field of fields) {
    try {
      let didFill = false;

      if (field.kind === 'input') {
        didFill = fillInput(field.element as HTMLInputElement, seenRadioGroups, mode, profile);
      } else if (field.kind === 'textarea') {
        didFill = fillTextarea(field.element as HTMLTextAreaElement, mode, profile);
      } else if (field.kind === 'select') {
        didFill = fillSelect(field.element as HTMLSelectElement, mode, profile);
      } else if (field.kind === 'combobox' || field.kind === 'listbox') {
        didFill = fillComboboxLike(field.element as HTMLElement, mode, profile);
      } else {
        didFill = fillEditable(field.element as HTMLElement, mode, profile);
      }

      if (didFill) {
        summary.filled += 1;
      } else {
        summary.skipped += 1;
      }
    } catch (error) {
      summary.errors += 1;
      options.onFieldError?.(field.element, error);
    }
  }

  if (options.promptResumeUpload) {
    try {
      summary.fileInputPrompted = promptResumeUpload(root);
    } catch {
      summary.fileInputPrompted = false;
    }
  }

  return summary;
}
