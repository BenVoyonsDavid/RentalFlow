const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REFERENCE_TOKEN_LENGTH = 10;

function dateStamp(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
}

function normalizePrefix(prefix: string): string {
  const normalized = String(prefix || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/^-+|-+$/g, '');

  if (!normalized) throw new Error('INVALID_REFERENCE_PREFIX');
  return normalized;
}

function secureRandomBytes(length: number): Uint8Array {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error('SECURE_RANDOM_UNAVAILABLE');

  const bytes = new Uint8Array(length);
  cryptoApi.getRandomValues(bytes);
  return bytes;
}

export function generateReferenceNumber(
  prefix: string,
  now = new Date(),
  entropy?: Uint8Array,
): string {
  if (!Number.isFinite(now.getTime())) throw new Error('INVALID_REFERENCE_DATE');

  const bytes = entropy ?? secureRandomBytes(REFERENCE_TOKEN_LENGTH);
  if (bytes.length < REFERENCE_TOKEN_LENGTH) throw new Error('INSUFFICIENT_REFERENCE_ENTROPY');

  const token = Array.from(bytes.slice(0, REFERENCE_TOKEN_LENGTH), (byte) =>
    REFERENCE_ALPHABET[byte & 31],
  ).join('');

  return `${normalizePrefix(prefix)}-${dateStamp(now)}-${token}`;
}
