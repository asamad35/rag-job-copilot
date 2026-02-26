export const RESUME_STORAGE_KEY = 'autofill_resume_payload_v1';

export interface StoredResumeFile {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  updatedAt: string;
}

function chromeStorageGet<T>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }

      const value = result[key] as T | undefined;
      resolve(value ?? null);
    });
  });
}

function chromeStorageSet(key: string, value: unknown): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }

      resolve(true);
    });
  });
}

function chromeStorageRemove(key: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.remove([key], () => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }

      resolve(true);
    });
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        reject(new Error('Unable to read file as data URL'));
        return;
      }

      resolve(dataUrl);
    };
    reader.onerror = () => {
      reject(new Error('FileReader failed'));
    };
    reader.readAsDataURL(file);
  });
}

export async function getStoredResume(): Promise<StoredResumeFile | null> {
  return chromeStorageGet<StoredResumeFile>(RESUME_STORAGE_KEY);
}

export async function saveResumeFromFile(
  file: File
): Promise<StoredResumeFile | null> {
  const dataUrl = await readFileAsDataUrl(file);

  const payload: StoredResumeFile = {
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    dataUrl,
    updatedAt: new Date().toISOString()
  };

  const didPersist = await chromeStorageSet(RESUME_STORAGE_KEY, payload);
  return didPersist ? payload : null;
}

export async function clearStoredResume(): Promise<boolean> {
  return chromeStorageRemove(RESUME_STORAGE_KEY);
}

export function dataUrlToFile(payload: StoredResumeFile): File | null {
  const separatorIndex = payload.dataUrl.indexOf(',');
  if (separatorIndex < 0) {
    return null;
  }

  const base64 = payload.dataUrl.slice(separatorIndex + 1);
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new File([bytes], payload.name, {
      type: payload.type,
      lastModified: Date.parse(payload.updatedAt) || Date.now()
    });
  } catch {
    return null;
  }
}
