import { EXCLUDED_INPUT_TYPES } from './constants';
import { hasDisabledAttribute, isVisibleEnough } from './dom';
import { shouldIgnoreElement } from './hints';
import type { FillableField } from './types';

function isFillableInput(input: HTMLInputElement): boolean {
  const type = input.type.toLowerCase();
  if (EXCLUDED_INPUT_TYPES.has(type)) {
    return false;
  }

  if (input.disabled) {
    return false;
  }

  const allowsReadonlyValueSet =
    type === 'date' ||
    type === 'datetime-local' ||
    type === 'month' ||
    type === 'time' ||
    type === 'week';
  if (input.readOnly && !allowsReadonlyValueSet) {
    return false;
  }

  return isVisibleEnough(input);
}

function isFillableTextarea(textarea: HTMLTextAreaElement): boolean {
  if (textarea.disabled || textarea.readOnly) {
    return false;
  }

  return isVisibleEnough(textarea);
}

function isFillableSelect(select: HTMLSelectElement): boolean {
  if (select.disabled) {
    return false;
  }

  return isVisibleEnough(select);
}

function isFillableEditableElement(element: HTMLElement): boolean {
  if (hasDisabledAttribute(element)) {
    return false;
  }

  if (!isVisibleEnough(element)) {
    return false;
  }

  const contentEditable = element.getAttribute('contenteditable') === 'true';
  const roleTextbox = element.getAttribute('role') === 'textbox';

  if (roleTextbox && element.getAttribute('aria-readonly') === 'true') {
    return false;
  }

  return contentEditable || roleTextbox;
}

function isFillableRoleControl(
  element: HTMLElement,
  role: 'combobox' | 'listbox'
): boolean {
  if (hasDisabledAttribute(element)) {
    return false;
  }

  if (!isVisibleEnough(element)) {
    return false;
  }

  if (element.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  return element.getAttribute('role') === role;
}

export function isFillableRadio(input: HTMLInputElement): boolean {
  return (
    input.type.toLowerCase() === 'radio' &&
    !input.disabled &&
    !input.readOnly &&
    isVisibleEnough(input)
  );
}

function detectField(element: Element): FillableField | undefined {
  if (shouldIgnoreElement(element)) {
    return undefined;
  }

  if (element instanceof HTMLInputElement) {
    if (isFillableInput(element)) {
      return { kind: 'input', element };
    }

    return undefined;
  }

  if (element instanceof HTMLTextAreaElement) {
    if (isFillableTextarea(element)) {
      return { kind: 'textarea', element };
    }

    return undefined;
  }

  if (element instanceof HTMLSelectElement) {
    if (isFillableSelect(element)) {
      return { kind: 'select', element };
    }

    return undefined;
  }

  if (element instanceof HTMLElement && isFillableRoleControl(element, 'combobox')) {
    return { kind: 'combobox', element };
  }

  if (element instanceof HTMLElement && isFillableRoleControl(element, 'listbox')) {
    return { kind: 'listbox', element };
  }

  if (element instanceof HTMLElement && isFillableEditableElement(element)) {
    return { kind: 'editable', element };
  }

  return undefined;
}

export function detectFillableFields(root: ParentNode = document): FillableField[] {
  const selector =
    'input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"], [role="listbox"]';
  const candidates = Array.from(root.querySelectorAll(selector));
  const seen = new Set<Element>();
  const fields: FillableField[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    const field = detectField(candidate);
    if (field) {
      fields.push(field);
    }
  }

  return fields;
}

export function detectUploadInputs(root: ParentNode = document): HTMLInputElement[] {
  return Array.from(root.querySelectorAll('input[type="file"]')).filter(
    (element): element is HTMLInputElement =>
      element instanceof HTMLInputElement && !element.disabled && isVisibleEnough(element)
  );
}

export function promptResumeUpload(root: ParentNode = document): boolean {
  const firstInput = detectUploadInputs(root)[0];
  if (!firstInput) {
    return false;
  }

  firstInput.click();
  return true;
}
