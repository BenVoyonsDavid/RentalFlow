import {
  SQUARE_APPLICATION_ID_LIVE,
  SQUARE_APPLICATION_ID_TEST,
  SQUARE_APPLICATION_SECRET_LIVE,
  SQUARE_APPLICATION_SECRET_TEST,
  SQUARE_SECURITY_SECRET,
} from 'astro:env/server';
import type { PaymentEnvironment } from './payment-provider';

const SQUARE_VERSION = '2026-08-19';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const SQUARE_OAUTH_SCOPES = [
  'MERCHANT_PROFILE_READ',
  'PAYMENTS_READ',
  'PAYMENTS_WRITE',
  'PAYMENTS_WRITE_ADDITIONAL_RECIPIENTS',
  'ORDERS_READ',
  'ORDERS_WRITE',
] as const;

export type SquareOAuthStatePayload = {
  v: 1;
  environment: PaymentEnvironment;
  instanceId: string;
  redirectUri: string;
  issuedAt: number;
  nonce: string;
};

type SquareOAuthTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_at?: string;
  merchant_id?: string;
  refresh_token?: string;
  short_lived?: boolean;
  errors?: Array<{ code?: string; detail?: string; category?: string }>;
};

type SquareMerchant = {
  id?: string;
  business_name?: string;
  country?: string;
  currency?: string;
  status?: string;
  main_location_id?: string;
};

type SquareLocation = {
  id?: string;
  name?: string;
  status?: string;
  country?: string;
  currency?: string;
  capabilities?: string[];
};

type SquareMerchantResponse = {
  merchant?: SquareMerchant[];
  errors?: Array<{ code?: string; detail?: string; category?: string }>;
};

type SquareLocationsResponse = {
  locations?: SquareLocation[];
  errors?: Array<{ code?: string; detail?: string; category?: string }>;
};

export class SquareOAuthServerError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = 'SquareOAuthServerError';
    this.status = status;
    this.code = code;
  }
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function base64UrlEncode(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return base64ToBytes(padded);
}

function squareBaseUrl(environment: PaymentEnvironment): string {
  return environment === 'LIVE' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
}

export function squareCredentials(environment: PaymentEnvironment) {
  const applicationId = clean(environment === 'LIVE' ? SQUARE_APPLICATION_ID_LIVE : SQUARE_APPLICATION_ID_TEST);
  const applicationSecret = clean(environment === 'LIVE' ? SQUARE_APPLICATION_SECRET_LIVE : SQUARE_APPLICATION_SECRET_TEST);
  const securitySecret = clean(SQUARE_SECURITY_SECRET);
  return {
    applicationId,
    applicationSecret,
    securitySecret,
    configured: Boolean(applicationId && applicationSecret && securitySecret),
  };
}

async function deriveKeyMaterial(purpose: 'tokens' | 'state'): Promise<Uint8Array> {
  const secret = clean(SQUARE_SECURITY_SECRET);
  if (!secret) {
    throw new SquareOAuthServerError('Square security secret is not configured.', 503, 'square_security_secret_missing');
  }
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`RentalFlow:${purpose}:${secret}`));
  return new Uint8Array(digest);
}

export async function encryptSquareSecret(value: string): Promise<string> {
  const plaintext = clean(value);
  if (!plaintext) return '';
  const keyMaterial = await deriveKeyMaterial('tokens');
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(keyMaterial), { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    encoder.encode(plaintext),
  );
  return `v1.${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(encrypted))}`;
}

export async function decryptSquareSecret(value: string): Promise<string> {
  const encryptedValue = clean(value);
  if (!encryptedValue) return '';
  const [version, ivPart, cipherPart] = encryptedValue.split('.');
  if (version !== 'v1' || !ivPart || !cipherPart) {
    throw new SquareOAuthServerError('Encrypted Square credential has an unsupported format.', 500, 'square_credential_format');
  }
  const keyMaterial = await deriveKeyMaterial('tokens');
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(keyMaterial), { name: 'AES-GCM' }, false, ['decrypt']);
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(base64UrlDecode(ivPart)) },
      key,
      toArrayBuffer(base64UrlDecode(cipherPart)),
    );
    return decoder.decode(decrypted);
  } catch {
    throw new SquareOAuthServerError('Unable to decrypt Square credential.', 500, 'square_credential_decrypt');
  }
}

export async function createSquareOAuthState(
  environment: PaymentEnvironment,
  instanceId: string,
  redirectUri: string,
): Promise<string> {
  const payload: SquareOAuthStatePayload = {
    v: 1,
    environment,
    instanceId,
    redirectUri,
    issuedAt: Date.now(),
    nonce: base64UrlEncode(crypto.getRandomValues(new Uint8Array(18))),
  };
  const payloadPart = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const keyMaterial = await deriveKeyMaterial('state');
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(keyMaterial), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadPart));
  return `${payloadPart}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifySquareOAuthState(value: string): Promise<SquareOAuthStatePayload> {
  const [payloadPart, signaturePart] = clean(value).split('.');
  if (!payloadPart || !signaturePart) {
    throw new SquareOAuthServerError('Invalid OAuth state.', 400, 'square_state_invalid');
  }
  const keyMaterial = await deriveKeyMaterial('state');
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(keyMaterial), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    toArrayBuffer(base64UrlDecode(signaturePart)),
    encoder.encode(payloadPart),
  );
  if (!valid) throw new SquareOAuthServerError('Invalid OAuth state signature.', 400, 'square_state_invalid');

  let payload: SquareOAuthStatePayload;
  try {
    payload = JSON.parse(decoder.decode(base64UrlDecode(payloadPart))) as SquareOAuthStatePayload;
  } catch {
    throw new SquareOAuthServerError('Invalid OAuth state payload.', 400, 'square_state_invalid');
  }

  if (payload.v !== 1 || !payload.instanceId || !payload.redirectUri || (payload.environment !== 'TEST' && payload.environment !== 'LIVE')) {
    throw new SquareOAuthServerError('Invalid OAuth state payload.', 400, 'square_state_invalid');
  }
  if (!Number.isFinite(payload.issuedAt) || Date.now() - payload.issuedAt > 10 * 60 * 1000 || payload.issuedAt > Date.now() + 60_000) {
    throw new SquareOAuthServerError('OAuth state expired. Please try connecting Square again.', 400, 'square_state_expired');
  }
  return payload;
}

export async function buildSquareAuthorizationUrl(
  environment: PaymentEnvironment,
  instanceId: string,
  redirectUri: string,
): Promise<string> {
  const credentials = squareCredentials(environment);
  if (!credentials.configured) {
    throw new SquareOAuthServerError('Square credentials are not configured for this environment.', 503, 'square_not_configured');
  }
  const state = await createSquareOAuthState(environment, instanceId, redirectUri);
  const url = new URL(`${squareBaseUrl(environment)}/oauth2/authorize`);
  url.searchParams.set('client_id', credentials.applicationId);
  url.searchParams.set('scope', SQUARE_OAUTH_SCOPES.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', redirectUri);
  if (environment === 'LIVE') url.searchParams.set('session', 'false');
  return url.toString();
}

async function readSquareResponse<T>(response: Response): Promise<T> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const errors = (payload as { errors?: Array<{ code?: string; detail?: string }> } | null)?.errors || [];
    const first = errors[0];
    throw new SquareOAuthServerError(
      first?.detail || `Square API request failed (${response.status}).`,
      response.status,
      first?.code || 'square_api_error',
    );
  }
  return payload as T;
}

export async function obtainSquareOAuthTokens(
  environment: PaymentEnvironment,
  code: string,
  redirectUri: string,
): Promise<Required<Pick<SquareOAuthTokenResponse, 'access_token' | 'refresh_token' | 'merchant_id'>> & SquareOAuthTokenResponse> {
  const credentials = squareCredentials(environment);
  if (!credentials.configured) {
    throw new SquareOAuthServerError('Square credentials are not configured for this environment.', 503, 'square_not_configured');
  }
  const response = await fetch(`${squareBaseUrl(environment)}/oauth2/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Square-Version': SQUARE_VERSION,
    },
    body: JSON.stringify({
      client_id: credentials.applicationId,
      client_secret: credentials.applicationSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const token = await readSquareResponse<SquareOAuthTokenResponse>(response);
  if (!token.access_token || !token.refresh_token || !token.merchant_id) {
    throw new SquareOAuthServerError('Square did not return complete OAuth credentials.', 502, 'square_token_incomplete');
  }
  return token as Required<Pick<SquareOAuthTokenResponse, 'access_token' | 'refresh_token' | 'merchant_id'>> & SquareOAuthTokenResponse;
}

export async function refreshSquareOAuthTokens(
  environment: PaymentEnvironment,
  refreshToken: string,
): Promise<Required<Pick<SquareOAuthTokenResponse, 'access_token' | 'refresh_token' | 'merchant_id'>> & SquareOAuthTokenResponse> {
  const credentials = squareCredentials(environment);
  if (!credentials.configured) {
    throw new SquareOAuthServerError('Square credentials are not configured for this environment.', 503, 'square_not_configured');
  }
  const response = await fetch(`${squareBaseUrl(environment)}/oauth2/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Square-Version': SQUARE_VERSION,
    },
    body: JSON.stringify({
      client_id: credentials.applicationId,
      client_secret: credentials.applicationSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const token = await readSquareResponse<SquareOAuthTokenResponse>(response);
  if (!token.access_token || !token.refresh_token || !token.merchant_id) {
    throw new SquareOAuthServerError('Square did not return complete refreshed OAuth credentials.', 502, 'square_token_incomplete');
  }
  return token as Required<Pick<SquareOAuthTokenResponse, 'access_token' | 'refresh_token' | 'merchant_id'>> & SquareOAuthTokenResponse;
}

async function squareApiGet<T>(environment: PaymentEnvironment, accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${squareBaseUrl(environment)}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Square-Version': SQUARE_VERSION,
      'content-type': 'application/json',
    },
  });
  return readSquareResponse<T>(response);
}

export async function getSquareAccountSnapshot(
  environment: PaymentEnvironment,
  accessToken: string,
  expectedMerchantId?: string,
) {
  const [merchantResponse, locationsResponse] = await Promise.all([
    squareApiGet<SquareMerchantResponse>(environment, accessToken, '/v2/merchants'),
    squareApiGet<SquareLocationsResponse>(environment, accessToken, '/v2/locations'),
  ]);
  const merchant = (merchantResponse.merchant || []).find((item) => !expectedMerchantId || item.id === expectedMerchantId)
    || merchantResponse.merchant?.[0];
  if (!merchant?.id) {
    throw new SquareOAuthServerError('Unable to retrieve the connected Square merchant.', 502, 'square_merchant_missing');
  }
  if (expectedMerchantId && merchant.id !== expectedMerchantId) {
    throw new SquareOAuthServerError('Square merchant identity does not match the stored authorization.', 409, 'square_merchant_mismatch');
  }

  const activeLocations = (locationsResponse.locations || []).filter((location) => location.status === 'ACTIVE');
  const paymentLocation = activeLocations.find((location) => (location.capabilities || []).includes('CREDIT_CARD_PROCESSING'));
  const merchantActive = merchant.status === 'ACTIVE';
  const chargesEnabled = merchantActive && Boolean(paymentLocation);
  const accountStatus = chargesEnabled ? 'READY' : merchantActive ? 'ONBOARDING' : 'RESTRICTED';
  const country = clean(merchant.country || paymentLocation?.country).toUpperCase();
  const defaultCurrency = clean(merchant.currency || paymentLocation?.currency).toUpperCase();

  return {
    accountId: merchant.id,
    accountStatus,
    detailsSubmitted: merchantActive,
    chargesEnabled,
    payoutsEnabled: merchantActive,
    requirementsCurrentlyDueJson: '[]',
    requirementsPastDueJson: accountStatus === 'RESTRICTED' ? JSON.stringify(['merchant_status']) : '[]',
    requirementsPendingVerificationJson: accountStatus === 'ONBOARDING' ? JSON.stringify(['payment_location']) : '[]',
    country,
    defaultCurrency,
    lastSyncedAt: new Date(),
    businessName: clean(merchant.business_name || paymentLocation?.name),
    mainLocationId: clean(merchant.main_location_id || paymentLocation?.id),
  };
}

export function squareTokenExpiresAt(value?: string): Date | null {
  const parsed = value ? new Date(value) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed : null;
}
