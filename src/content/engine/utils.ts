export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function extractDigits(value: string): string {
  return value.replace(/\D+/g, '');
}

export function splitMobileNumber(mobile: string): {
  countryCode: string;
  localNumber: string;
} {
  const digits = extractDigits(mobile);
  if (!digits) {
    return { countryCode: '+91', localNumber: '' };
  }

  if (digits.length <= 10) {
    return { countryCode: '+91', localNumber: digits };
  }

  const localNumber = digits.slice(-10);
  const countryCodeDigits = digits.slice(0, -10) || '91';
  return { countryCode: `+${countryCodeDigits}`, localNumber };
}

export function formatDateDdMmYyyy(date: Date): string {
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const year = `${date.getFullYear()}`;
  return `${day}/${month}/${year}`;
}

export function escapeForSelector(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/[\\"]/g, '\\$&');
}
