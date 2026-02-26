import {
  detectFillableFields,
  detectUploadInputs,
  fillDetectedFields,
  type FillMode,
  type FillSummary
} from './formEngine';
import type {
  FillResponse,
  FormStatusResponse,
  PopupMessage
} from '../shared/messages';

const LOG_PREFIX = '[autofill-v1]';
const OBSERVER_THROTTLE_MS = 250;
const FLOATING_WIDGET_ID = 'autofill-v1-floating-widget';

interface FormStatus {
  count: number;
  fileInputs: number;
}

interface FloatingWidgetRefs {
  root: HTMLDivElement;
  countText: HTMLParagraphElement;
  fileText: HTMLParagraphElement;
  actionButton: HTMLButtonElement;
  statusText: HTMLParagraphElement;
}

let cachedStatus: FormStatus = { count: 0, fileInputs: 0 };
let widgetRefs: FloatingWidgetRefs | null = null;

function log(message: string): void {
  console.log(`${LOG_PREFIX} ${message}`);
}

function logError(message: string, error: unknown): void {
  console.error(`${LOG_PREFIX} ${message}`, error);
}

function createFloatingWidget(): FloatingWidgetRefs {
  const existing = document.getElementById(FLOATING_WIDGET_ID);
  if (existing) {
    existing.remove();
  }

  const root = document.createElement('div');
  root.id = FLOATING_WIDGET_ID;
  root.style.position = 'fixed';
  root.style.right = '16px';
  root.style.bottom = '16px';
  root.style.zIndex = '2147483646';
  root.style.width = '248px';
  root.style.padding = '10px';
  root.style.borderRadius = '10px';
  root.style.background = '#111827';
  root.style.color = '#f9fafb';
  root.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  root.style.boxShadow = '0 10px 22px rgba(0,0,0,0.28)';
  root.style.display = 'none';

  const heading = document.createElement('p');
  heading.textContent = 'Autofill Assistant';
  heading.style.margin = '0 0 6px';
  heading.style.fontSize = '13px';
  heading.style.fontWeight = '700';

  const countText = document.createElement('p');
  countText.style.margin = '0';
  countText.style.fontSize = '12px';

  const fileText = document.createElement('p');
  fileText.style.margin = '6px 0 0';
  fileText.style.fontSize = '11px';
  fileText.style.color = '#cbd5e1';

  const actionButton = document.createElement('button');
  actionButton.type = 'button';
  actionButton.textContent = 'Fill With Profile';
  actionButton.style.width = '100%';
  actionButton.style.marginTop = '8px';
  actionButton.style.border = '0';
  actionButton.style.borderRadius = '8px';
  actionButton.style.padding = '8px';
  actionButton.style.cursor = 'pointer';
  actionButton.style.fontWeight = '600';
  actionButton.style.background = '#22d3ee';
  actionButton.style.color = '#082f49';

  const statusText = document.createElement('p');
  statusText.style.minHeight = '16px';
  statusText.style.margin = '8px 0 0';
  statusText.style.fontSize = '11px';
  statusText.style.color = '#bae6fd';

  root.append(heading, countText, fileText, actionButton, statusText);
  document.documentElement.appendChild(root);

  actionButton.addEventListener('click', () => {
    actionButton.disabled = true;
    statusText.textContent = 'Filling profile...';

    const result = executeFill('profile', true);
    statusText.textContent = `Filled ${result.filled}/${result.total}. Errors: ${result.errors}.`;

    if (result.fileInputsDetected > 0) {
      const suffix = result.fileInputPrompted
        ? `Choose ${result.fileInputsDetected > 1 ? 'a file' : 'the file'} in the browser picker.`
        : 'Resume upload field detected. Select file manually.';
      statusText.textContent = `${statusText.textContent} ${suffix}`;
    }

    actionButton.disabled = cachedStatus.count < 1;
  });

  return {
    root,
    countText,
    fileText,
    actionButton,
    statusText
  };
}

function ensureFloatingWidget(): FloatingWidgetRefs {
  if (!widgetRefs) {
    widgetRefs = createFloatingWidget();
  }

  return widgetRefs;
}

function updateFloatingWidget(status: FormStatus): void {
  const widget = ensureFloatingWidget();

  if (status.count < 1) {
    widget.root.style.display = 'none';
    return;
  }

  widget.root.style.display = 'block';
  widget.countText.textContent = `Form detected: ${status.count} fields.`;
  widget.fileText.textContent =
    status.fileInputs > 0
      ? `Resume upload field detected: ${status.fileInputs}`
      : 'No upload field detected.';
  widget.actionButton.disabled = status.count < 1;
}

function refreshFormStatus(logOnChange: boolean): FormStatus {
  const nextStatus: FormStatus = {
    count: detectFillableFields().length,
    fileInputs: detectUploadInputs().length
  };

  const changed =
    nextStatus.count !== cachedStatus.count ||
    nextStatus.fileInputs !== cachedStatus.fileInputs;
  if (changed) {
    cachedStatus = nextStatus;
    updateFloatingWidget(cachedStatus);

    if (logOnChange) {
      log(
        `Detected forms changed: fields=${cachedStatus.count}, fileInputs=${cachedStatus.fileInputs}`
      );
    }
  }

  return cachedStatus;
}

function throttle(callback: () => void, delayMs: number): () => void {
  let timeoutId: number | undefined;
  let shouldRunAgain = false;

  return () => {
    if (timeoutId !== undefined) {
      shouldRunAgain = true;
      return;
    }

    callback();
    timeoutId = window.setTimeout(() => {
      timeoutId = undefined;
      if (shouldRunAgain) {
        shouldRunAgain = false;
        callback();
      }
    }, delayMs);
  };
}

function setupMutationObserver(): void {
  const root = document.documentElement;
  if (!root) {
    return;
  }

  const onMutate = throttle(() => {
    refreshFormStatus(true);
  }, OBSERVER_THROTTLE_MS);

  const observer = new MutationObserver(() => {
    onMutate();
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'type',
      'disabled',
      'readonly',
      'style',
      'class',
      'hidden',
      'contenteditable',
      'role',
      'aria-label',
      'aria-disabled',
      'aria-expanded'
    ]
  });
}

function executeFill(mode: FillMode, promptResumeUpload: boolean): FillSummary {
  const result = fillDetectedFields(document, {
    mode,
    promptResumeUpload,
    onFieldError: (element, error) => {
      logError(`Failed to fill element ${element.tagName}`, error);
    }
  });

  log(
    `Fill executed mode=${mode}. total=${result.total}, filled=${result.filled}, skipped=${result.skipped}, errors=${result.errors}, fileInputs=${result.fileInputsDetected}, filePrompted=${result.fileInputPrompted}`
  );

  refreshFormStatus(false);
  return result;
}

function handleMessage(
  message: PopupMessage,
  sendResponse: (response: FormStatusResponse | FillResponse) => void
): void {
  if (message.type === 'GET_FORM_STATUS') {
    sendResponse(refreshFormStatus(false));
    return;
  }

  if (message.type === 'FILL_WITH_TEST') {
    const result = executeFill('test', false);
    sendResponse({ ...refreshFormStatus(false), result });
    return;
  }

  const result = executeFill('profile', message.promptResumeUpload ?? true);
  sendResponse({ ...refreshFormStatus(false), result });
}

function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!message || typeof message !== 'object' || !('type' in message)) {
      return;
    }

    const typedMessage = message as PopupMessage;
    if (
      typedMessage.type !== 'GET_FORM_STATUS' &&
      typedMessage.type !== 'FILL_WITH_TEST' &&
      typedMessage.type !== 'FILL_WITH_PROFILE'
    ) {
      return;
    }

    handleMessage(typedMessage, sendResponse);
  });
}

function init(): void {
  cachedStatus = {
    count: detectFillableFields().length,
    fileInputs: detectUploadInputs().length
  };

  updateFloatingWidget(cachedStatus);
  log(
    `Initial detected status: fields=${cachedStatus.count}, fileInputs=${cachedStatus.fileInputs}`
  );

  setupMutationObserver();
  setupMessageListener();
}

init();
