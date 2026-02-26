import type {
  FillResponse,
  FormStatusResponse,
  PopupMessage
} from '../shared/messages';

function requireElement<TElement extends Element>(selector: string): TElement {
  const element = document.querySelector<TElement>(selector);
  if (!element) {
    throw new Error(`Popup DOM is missing required element: ${selector}`);
  }

  return element;
}

const countElement = requireElement<HTMLParagraphElement>('#field-count');
const fileCountElement = requireElement<HTMLParagraphElement>('#file-count');
const fillProfileButton = requireElement<HTMLButtonElement>('#fill-profile-button');
const fillTestButton = requireElement<HTMLButtonElement>('#fill-test-button');
const closePopupButton = requireElement<HTMLButtonElement>('#close-popup-button');
const statusElement = requireElement<HTMLParagraphElement>('#status');

function setStatus(message: string): void {
  statusElement.textContent = message;
}

function setCount(status: FormStatusResponse): void {
  countElement.textContent = `Detected fields: ${status.count}`;
  fileCountElement.textContent =
    status.fileInputs > 0
      ? `Resume upload fields detected: ${status.fileInputs}`
      : 'Resume upload fields detected: 0';
}

function getActiveTabId(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]?.id ?? null);
    });
  });
}

function sendMessageToTab<TResponse>(
  tabId: number,
  message: PopupMessage
): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response: TResponse | undefined) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }

      if (!response) {
        reject(new Error('No response from content script.'));
        return;
      }

      resolve(response);
    });
  });
}

async function loadFormStatus(tabId: number): Promise<FormStatusResponse> {
  return sendMessageToTab<FormStatusResponse>(tabId, {
    type: 'GET_FORM_STATUS'
  });
}

async function fillProfile(tabId: number): Promise<FillResponse> {
  return sendMessageToTab<FillResponse>(tabId, {
    type: 'FILL_WITH_PROFILE',
    promptResumeUpload: true
  });
}

async function fillTest(tabId: number): Promise<FillResponse> {
  return sendMessageToTab<FillResponse>(tabId, {
    type: 'FILL_WITH_TEST'
  });
}

function setButtonsDisabled(disabled: boolean): void {
  fillProfileButton.disabled = disabled;
  fillTestButton.disabled = disabled;
}

async function initPopup(): Promise<void> {
  closePopupButton.addEventListener('click', () => {
    window.close();
  });

  setButtonsDisabled(true);
  setStatus('Scanning page...');

  const tabId = await getActiveTabId();
  if (tabId === null) {
    setCount({ count: 0, fileInputs: 0 });
    setStatus('No active tab found.');
    return;
  }

  try {
    const status = await loadFormStatus(tabId);
    setCount(status);

    if (status.count < 1) {
      setButtonsDisabled(true);
      setStatus('No forms detected. The page widget appears automatically when forms are available.');
      return;
    }

    setButtonsDisabled(false);
    setStatus(`Form detected: ${status.count} fields. Fill with profile data?`);
  } catch {
    setCount({ count: 0, fileInputs: 0 });
    setButtonsDisabled(true);
    setStatus('Cannot access this page (browser restricted or no script).');
    return;
  }

  fillProfileButton.addEventListener('click', async () => {
    setButtonsDisabled(true);
    setStatus('Filling with profile...');

    try {
      const result = await fillProfile(tabId);
      setCount(result);
      const uploadSuffix =
        result.result.fileInputsDetected > 0
          ? result.result.fileInputPrompted
            ? ' File picker opened for resume upload.'
            : ' Resume upload field found. Select the file manually.'
          : '';
      setStatus(
        `Filled ${result.result.filled}/${result.result.total}. Errors: ${result.result.errors}.${uploadSuffix}`
      );
    } catch {
      setStatus('Profile fill failed. Reload the page and try again.');
    } finally {
      const fieldCount = Number.parseInt(
        countElement.textContent?.replace(/\D/g, '') ?? '0',
        10
      );
      setButtonsDisabled(fieldCount < 1);
    }
  });

  fillTestButton.addEventListener('click', async () => {
    setButtonsDisabled(true);
    setStatus('Filling with test values...');

    try {
      const result = await fillTest(tabId);
      setCount(result);
      setStatus(
        `Filled ${result.result.filled}/${result.result.total}. Errors: ${result.result.errors}.`
      );
    } catch {
      setStatus('Test fill failed. Reload the page and try again.');
    } finally {
      const fieldCount = Number.parseInt(
        countElement.textContent?.replace(/\D/g, '') ?? '0',
        10
      );
      setButtonsDisabled(fieldCount < 1);
    }
  });
}

void initPopup();
