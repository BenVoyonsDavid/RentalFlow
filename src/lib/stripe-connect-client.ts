import { httpClient } from '@wix/essentials';
import type { PaymentEnvironment } from './payment-provider';

export type StripeConnectPublicRecord = {
  _id?: string;
  settingsKey?: string;
  payflowProvider?: string;
  payflowEnvironment?: string;
  payflowAccountId?: string;
  payflowAccountStatus?: string;
  payflowDetailsSubmitted?: boolean;
  payflowChargesEnabled?: boolean;
  payflowPayoutsEnabled?: boolean;
  payflowRequirementsCurrentlyDueJson?: string;
  payflowRequirementsPastDueJson?: string;
  payflowRequirementsPendingVerificationJson?: string;
  payflowCountry?: string;
  payflowDefaultCurrency?: string;
  payflowLastSyncedAt?: Date | string | null;
};

export type StripeConnectApiResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  publishableKey?: string;
  clientSecret?: string;
  expiresAt?: number;
  environments?: { TEST?: boolean; LIVE?: boolean };
  record?: StripeConnectPublicRecord;
};

function endpoint(): string {
  const origin = String(import.meta.env.BASE_API_URL || '').replace(/\/$/, '');
  if (!origin) throw new Error('RentalFlow API URL is unavailable.');
  return `${origin}/api/stripe-connect`;
}

async function parseResponse(response: Response): Promise<StripeConnectApiResponse> {
  let payload: StripeConnectApiResponse = {};
  try {
    payload = await response.json() as StripeConnectApiResponse;
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const error = new Error(payload.error || `Stripe Connect request failed (${response.status}).`);
    (error as Error & { code?: string }).code = payload.code;
    throw error;
  }
  return payload;
}

export async function getStripeConnectConfiguration(): Promise<StripeConnectApiResponse> {
  const response = await httpClient.fetchWithAuth(endpoint(), {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  return parseResponse(response);
}

export async function runStripeConnectAction(
  action: 'connect' | 'session' | 'refresh',
  environment: PaymentEnvironment,
): Promise<StripeConnectApiResponse> {
  const response = await httpClient.fetchWithAuth(endpoint(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ action, environment }),
  });
  return parseResponse(response);
}
