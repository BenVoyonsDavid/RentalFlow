import {
  STRIPE_PUBLISHABLE_KEY_LIVE,
  STRIPE_PUBLISHABLE_KEY_TEST,
  STRIPE_SECRET_KEY_LIVE,
  STRIPE_SECRET_KEY_TEST,
} from 'astro:env/server';
import type { PaymentEnvironment } from './payment-provider';

const STRIPE_API = 'https://api.stripe.com/v1';

type StripeRequirements = {
  currently_due?: string[];
  past_due?: string[];
  pending_verification?: string[];
};

export type StripeConnectedAccount = {
  id: string;
  object?: string;
  type?: string;
  country?: string;
  default_currency?: string;
  details_submitted?: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  requirements?: StripeRequirements;
};

type StripeAccountSession = {
  client_secret?: string;
  expires_at?: number;
  livemode?: boolean;
};

type StripeErrorPayload = {
  error?: {
    message?: string;
    code?: string;
    type?: string;
  };
};

export type StripeConnectCredentials = {
  secretKey: string;
  publishableKey: string;
  configured: boolean;
};

export class StripeConnectServerError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = 'StripeConnectServerError';
    this.status = status;
    this.code = code;
  }
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function stripeConnectCredentials(environment: PaymentEnvironment): StripeConnectCredentials {
  const secretKey = clean(environment === 'LIVE' ? STRIPE_SECRET_KEY_LIVE : STRIPE_SECRET_KEY_TEST);
  const publishableKey = clean(environment === 'LIVE' ? STRIPE_PUBLISHABLE_KEY_LIVE : STRIPE_PUBLISHABLE_KEY_TEST);
  return {
    secretKey,
    publishableKey,
    configured: Boolean(secretKey && publishableKey),
  };
}

async function readStripeResponse<T>(response: Response): Promise<T> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const stripeError = (payload || {}) as StripeErrorPayload;
    const message = stripeError.error?.message || `Stripe API request failed (${response.status}).`;
    throw new StripeConnectServerError(message, response.status, stripeError.error?.code || stripeError.error?.type);
  }

  return payload as T;
}

async function stripeRequest<T>(
  secretKey: string,
  path: string,
  options: { method?: 'GET' | 'POST'; body?: URLSearchParams } = {},
): Promise<T> {
  if (!secretKey) throw new StripeConnectServerError('Stripe platform credentials are not configured.', 503, 'stripe_not_configured');

  const method = options.method || 'GET';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
  };
  if (options.body) headers['content-type'] = 'application/x-www-form-urlencoded';

  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers,
    body: options.body,
  });

  return readStripeResponse<T>(response);
}

export async function createStripeConnectedAccount(
  environment: PaymentEnvironment,
  instanceId: string,
): Promise<StripeConnectedAccount> {
  const credentials = stripeConnectCredentials(environment);
  if (!credentials.configured) {
    throw new StripeConnectServerError('Stripe platform credentials are not configured for this environment.', 503, 'stripe_not_configured');
  }

  // No legacy account type or custom controller settings are supplied here.
  // Stripe therefore creates the Standard-equivalent controller configuration:
  // Stripe collects requirements and loss responsibility, the connected account pays Stripe fees,
  // and the account has full Dashboard access. This is compatible with direct charges for SaaS.
  const body = new URLSearchParams();
  body.set('metadata[rentalflow_instance_id]', instanceId);
  body.set('metadata[rentalflow_product]', 'RentalFlow');

  return stripeRequest<StripeConnectedAccount>(credentials.secretKey, '/accounts', {
    method: 'POST',
    body,
  });
}

export async function retrieveStripeConnectedAccount(
  environment: PaymentEnvironment,
  accountId: string,
): Promise<StripeConnectedAccount> {
  const credentials = stripeConnectCredentials(environment);
  if (!credentials.configured) {
    throw new StripeConnectServerError('Stripe platform credentials are not configured for this environment.', 503, 'stripe_not_configured');
  }
  if (!accountId) throw new StripeConnectServerError('No Stripe connected account is associated with this installation.', 400, 'stripe_account_missing');

  return stripeRequest<StripeConnectedAccount>(credentials.secretKey, `/accounts/${encodeURIComponent(accountId)}`);
}

export async function createStripeAccountSession(
  environment: PaymentEnvironment,
  accountId: string,
): Promise<{ clientSecret: string; expiresAt?: number; publishableKey: string }> {
  const credentials = stripeConnectCredentials(environment);
  if (!credentials.configured) {
    throw new StripeConnectServerError('Stripe platform credentials are not configured for this environment.', 503, 'stripe_not_configured');
  }
  if (!accountId) throw new StripeConnectServerError('No Stripe connected account is associated with this installation.', 400, 'stripe_account_missing');

  const body = new URLSearchParams();
  body.set('account', accountId);
  body.set('components[account_onboarding][enabled]', 'true');

  const session = await stripeRequest<StripeAccountSession>(credentials.secretKey, '/account_sessions', {
    method: 'POST',
    body,
  });

  if (!session.client_secret) {
    throw new StripeConnectServerError('Stripe did not return an onboarding client secret.', 502, 'stripe_session_missing_secret');
  }

  return {
    clientSecret: session.client_secret,
    expiresAt: session.expires_at,
    publishableKey: credentials.publishableKey,
  };
}

export function stripeAccountSnapshot(account: StripeConnectedAccount) {
  const currentlyDue = account.requirements?.currently_due || [];
  const pastDue = account.requirements?.past_due || [];
  const pendingVerification = account.requirements?.pending_verification || [];
  const ready = account.details_submitted === true && account.charges_enabled === true && account.payouts_enabled === true;

  return {
    accountId: account.id,
    accountStatus: ready ? 'READY' : pastDue.length > 0 ? 'RESTRICTED' : 'ONBOARDING',
    detailsSubmitted: account.details_submitted === true,
    chargesEnabled: account.charges_enabled === true,
    payoutsEnabled: account.payouts_enabled === true,
    requirementsCurrentlyDueJson: JSON.stringify(currentlyDue),
    requirementsPastDueJson: JSON.stringify(pastDue),
    requirementsPendingVerificationJson: JSON.stringify(pendingVerification),
    country: clean(account.country).toUpperCase(),
    defaultCurrency: clean(account.default_currency).toUpperCase(),
    lastSyncedAt: new Date(),
  };
}
