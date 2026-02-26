export function isVisibleEnough(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (element.offsetParent !== null) {
    return true;
  }

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }

  return true;
}

export function hasDisabledAttribute(element: Element): boolean {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    return element.disabled;
  }

  return (
    element.hasAttribute('disabled') ||
    element.getAttribute('aria-disabled') === 'true'
  );
}

const inputValueSetter = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype,
  'value'
)?.set;
const inputCheckedSetter = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype,
  'checked'
)?.set;
const textareaValueSetter = Object.getOwnPropertyDescriptor(
  HTMLTextAreaElement.prototype,
  'value'
)?.set;
const selectValueSetter = Object.getOwnPropertyDescriptor(
  HTMLSelectElement.prototype,
  'value'
)?.set;

export function setInputValue(input: HTMLInputElement, value: string): void {
  if (inputValueSetter) {
    inputValueSetter.call(input, value);
    return;
  }

  input.value = value;
}

export function setTextareaValue(
  textarea: HTMLTextAreaElement,
  value: string
): void {
  if (textareaValueSetter) {
    textareaValueSetter.call(textarea, value);
    return;
  }

  textarea.value = value;
}

export function setSelectValue(select: HTMLSelectElement, value: string): void {
  if (selectValueSetter) {
    selectValueSetter.call(select, value);
    return;
  }

  select.value = value;
}

export function setChecked(input: HTMLInputElement, checked: boolean): void {
  if (inputCheckedSetter) {
    inputCheckedSetter.call(input, checked);
    return;
  }

  input.checked = checked;
}

export function emitFieldEvents(element: Element): void {
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
