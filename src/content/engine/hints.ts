import { escapeForSelector, normalizeText } from './utils';

export function isLikelyCaptchaHint(hint: string): boolean {
  return hint.includes('captcha');
}

const MAX_LABEL_TEXT_LENGTH = 180;
const MAX_PARENT_SCAN_DEPTH = 4;
const MAX_SIBLINGS_PER_LEVEL = 3;

function pushUniqueLabel(labels: string[], rawText: string | null | undefined): void {
  const normalized = rawText?.replace(/\s+/g, ' ').trim() ?? '';
  if (!normalized || normalized.length > MAX_LABEL_TEXT_LENGTH) {
    return;
  }

  if (!labels.includes(normalized)) {
    labels.push(normalized);
  }
}

function collectAriaLabelledByText(
  element: HTMLElement,
  labels: string[]
): void {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (!labelledBy) {
    return;
  }

  for (const id of labelledBy.split(/\s+/).filter(Boolean)) {
    const ref = document.getElementById(id);
    pushUniqueLabel(labels, ref?.textContent);
  }
}

function collectNearbySiblingLabelText(
  element: HTMLElement,
  labels: string[]
): void {
  let current: HTMLElement | null = element;

  for (let depth = 0; depth < MAX_PARENT_SCAN_DEPTH && current; depth += 1) {
    let sibling = current.previousElementSibling;
    let scanned = 0;
    let foundLabelAtLevel = false;

    while (sibling && scanned < MAX_SIBLINGS_PER_LEVEL) {
      scanned += 1;

      if (!(sibling instanceof HTMLElement)) {
        sibling = sibling.previousElementSibling;
        continue;
      }

      if (sibling.matches('label, legend')) {
        pushUniqueLabel(labels, sibling.textContent);
        foundLabelAtLevel = true;
      }

      const nestedLabel = sibling.querySelector('label, legend');
      if (nestedLabel) {
        pushUniqueLabel(labels, nestedLabel.textContent);
        foundLabelAtLevel = true;
      }

      const dataContent = sibling.getAttribute('data-content');
      if (dataContent) {
        pushUniqueLabel(labels, dataContent);
        foundLabelAtLevel = true;
      }

      const ariaLabel = sibling.getAttribute('aria-label');
      if (ariaLabel) {
        pushUniqueLabel(labels, ariaLabel);
        foundLabelAtLevel = true;
      }

      if (foundLabelAtLevel) {
        break;
      }

      sibling = sibling.previousElementSibling;
    }

    if (foundLabelAtLevel) {
      break;
    }

    current = current.parentElement;
  }
}

function collectNearestSingleContainerLabel(
  element: HTMLElement,
  labels: string[]
): void {
  const fieldSelector =
    'input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"], [role="listbox"]';
  let current: HTMLElement | null = element.parentElement;

  for (let depth = 0; depth < MAX_PARENT_SCAN_DEPTH && current; depth += 1) {
    const fieldCount = current.querySelectorAll(fieldSelector).length;
    if (fieldCount > 2) {
      current = current.parentElement;
      continue;
    }

    if (element.id) {
      const linked = current.querySelector(
        `label[for="${escapeForSelector(element.id)}"]`
      );
      if (linked) {
        pushUniqueLabel(labels, linked.textContent);
        return;
      }
    }

    const containerLabels = current.querySelectorAll('label, legend');
    if (containerLabels.length === 1) {
      pushUniqueLabel(labels, containerLabels[0]?.textContent ?? null);
      return;
    }

    current = current.parentElement;
  }
}

function extractLabelText(element: Element): string {
  const labels: string[] = [];

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    for (const label of Array.from(element.labels ?? [])) {
      const text = label.textContent?.trim();
      if (text) {
        labels.push(text);
      }
    }
  }

  if (element instanceof HTMLElement) {
    const parentLabel = element.closest('label');
    const parentText = parentLabel?.textContent?.trim();
    if (parentText) {
      pushUniqueLabel(labels, parentText);
    }

    if (element.id) {
      for (const label of Array.from(
        document.querySelectorAll(`label[for="${escapeForSelector(element.id)}"]`)
      )) {
        const text = label.textContent?.trim();
        if (text) {
          pushUniqueLabel(labels, text);
        }
      }
    }

    collectAriaLabelledByText(element, labels);
    collectNearbySiblingLabelText(element, labels);
    collectNearestSingleContainerLabel(element, labels);
  }

  return labels.join(' ');
}

export function collectHints(element: Element): string {
  const parts: string[] = [];

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    const attrs = [
      element.name,
      element.id,
      element.getAttribute('placeholder') ?? '',
      element.getAttribute('aria-label') ?? '',
      element.getAttribute('autocomplete') ?? '',
      element.getAttribute('title') ?? '',
      element.getAttribute('data-testid') ?? ''
    ];
    for (const value of attrs) {
      if (value) {
        parts.push(value);
      }
    }

    if (element instanceof HTMLInputElement) {
      parts.push(element.type);
      parts.push(element.value);
    }
  }

  if (element instanceof HTMLElement) {
    parts.push(element.getAttribute('role') ?? '');
    parts.push(element.getAttribute('aria-labelledby') ?? '');
    parts.push(element.getAttribute('aria-describedby') ?? '');

    for (const [key, value] of Object.entries(element.dataset)) {
      parts.push(key);
      if (value) {
        parts.push(value);
      }
    }

    const ownText = element.textContent?.trim();
    if (ownText && ownText.length <= 120) {
      parts.push(ownText);
    }
  }

  parts.push(extractLabelText(element));
  return normalizeText(parts.join(' '));
}

export function shouldIgnoreElement(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const marker = normalizeText(
    [
      element.id,
      element.getAttribute('name') ?? '',
      element.getAttribute('placeholder') ?? '',
      element.getAttribute('aria-label') ?? '',
      element.className
    ]
      .filter(Boolean)
      .join(' ')
  );

  if (isLikelyCaptchaHint(marker)) {
    return true;
  }

  if (marker.includes('one time password') || marker.includes(' otp ')) {
    return true;
  }

  return false;
}
