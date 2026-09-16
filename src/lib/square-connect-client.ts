import { httpClient } from '@wix/essentials';
import type { PaymentEnvironment } from './payment-provider';

export type SquarePaymentAccountRecord = {
  _id?: string;
  settingsKey?: string;
  provider?: string;
  environment?: string;
  accountId?: string;
  // Compatibility alias for the legacy app-settings payment snapshot. Square itself uses accountId.
  payflowAccountId?: string;
  accountStatus?: string;
  detailsSubmitted?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  requirementsCurrentlyDueJson?: string;
  requirementsPastDueJson?: string;
  requirementsPendingVerificationJson?: string;
  country?: string;
  defaultCurrency?: string;
  lastSyncedAt?: Date | string | null;
  active?: boolean;
};

type SquareConnectConfiguration = {
  ok?: boolean;
  environments?: { TEST?: boolean; LIVE?: boolean };
  callbackUrl?: string;
  callbackIsHttps?: boolean;
  account?: SquarePaymentAccountRecord | null;
  error?: string;
  code?: string;
};

type SquareConnectActionResponse = SquareConnectConfiguration & {
  authorizeUrl?: string;
};

const moduleOrigin = (() => {
  try {
    const origin = new URL(import.meta.url).origin;
    return origin === 'null' ? '' : origin.replace(/\/$/, '');
  } catch {
    return '';
  }
})();

function apiOrigin(baseUrl?: string): string {
  const explicit = String(baseUrl || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;
  if (moduleOrigin) return moduleOrigin;
  return String(import.meta.env.BASE_API_URL || '').replace(/\/$/, '');
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Square Connect request failed (${response.status}).`);
  return payload;
}

export async function getSquareConnectConfiguration(
  baseUrl?: string,
): Promise<SquareConnectConfiguration> {
  const origin = apiOrigin(baseUrl);
  if (!origin) throw new Error('RentalFlow backend URL is unavailable.');
  const response = await httpClient.fetchWithAuth(`${origin}/api/square-connect`, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  return parseResponse<SquareConnectConfiguration>(response);
}

export async function runSquareConnectAction(
  action: 'start' | 'refresh' | 'complete',
  environment: PaymentEnvironment,
  options: { code?: string; state?: string; baseUrl?: string } = {},
): Promise<SquareConnectActionResponse> {
  const origin = apiOrigin(options.baseUrl);
  if (!origin) throw new Error('RentalFlow backend URL is unavailable.');
  const response = await httpClient.fetchWithAuth(`${origin}/api/square-connect`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      action,
      environment,
      ...(options.code ? { code: options.code } : {}),
      ...(options.state ? { state: options.state } : {}),
    }),
  });
  return parseResponse<SquareConnectActionResponse>(response);
}
