import type { APIRoute } from 'astro';
import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import { normalizePaymentEnvironment, type PaymentEnvironment } from '../../lib/payment-provider';
import {
  createStripeAccountSession,
  createStripeConnectedAccount,
  retrieveStripeConnectedAccount,
  stripeAccountSnapshot,
  stripeConnectCredentials,
  StripeConnectServerError,
} from '../../lib/stripe-connect-server';

const APP_SETTINGS = '@pilotedavid1/rental-flow/app-settings';

type AppSettingsRecord = Record<string, unknown> & {
  _id?: string;
  settingsKey?: string;
  payflowProvider?: string;
  payflowEnvironment?: string;
  payflowAccountId?: string;
};

type StripeAction = 'connect' | 'session' | 'refresh';

type StripeRequestBody = {
  action?: StripeAction;
  environment?: string;
};

const elevatedQuery = auth.elevate(items.query);
const elevatedInsert = auth.elevate(items.insert);
const elevatedUpdate = auth.elevate(items.update);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

async function requireDashboardUser(): Promise<{ instanceId: string }> {
  const tokenInfo = await auth.getTokenInfo();
  const instanceId = tokenInfo.instanceId;
  if (!tokenInfo.active || tokenInfo.subjectType !== 'USER' || !instanceId) {
    throw new StripeConnectServerError('Unauthorized dashboard request.', 403, 'unauthorized');
  }
  return { instanceId };
}

async function loadSettings(): Promise<AppSettingsRecord> {
  const result = await elevatedQuery(APP_SETTINGS).eq('settingsKey', 'default').limit(1).find();
  return (result.items?.[0] as AppSettingsRecord | undefined) || { settingsKey: 'default' };
}

async function saveSettings(record: AppSettingsRecord): Promise<AppSettingsRecord> {
  const payload: AppSettingsRecord = {
    ...record,
    settingsKey: 'default',
    active: true,
  };
  if (record._id) return elevatedUpdate(APP_SETTINGS, payload) as Promise<AppSettingsRecord>;
  return elevatedInsert(APP_SETTINGS, payload) as Promise<AppSettingsRecord>;
}

function environmentMismatch(record: AppSettingsRecord, environment: PaymentEnvironment): boolean {
  return Boolean(record.payflowAccountId) && normalizePaymentEnvironment(record.payflowEnvironment) !== environment;
}

async function ensureAccount(
  record: AppSettingsRecord,
  environment: PaymentEnvironment,
  instanceId: string,
) {
  if (environmentMismatch(record, environment)) {
    throw new StripeConnectServerError(
      'The selected Stripe environment differs from the environment of the connected account. Save the environment change first.',
      409,
      'stripe_environment_mismatch',
    );
  }

  let account;
  if (record.payflowAccountId) {
    account = await retrieveStripeConnectedAccount(environment, record.payflowAccountId);
  } else {
    account = await createStripeConnectedAccount(environment, instanceId);
  }

  const snapshot = stripeAccountSnapshot(account);
  const saved = await saveSettings({
    ...record,
    payflowProvider: 'PAYFLOW_STRIPE',
    payflowEnvironment: environment,
    payflowAccountId: snapshot.accountId,
    payflowAccountStatus: snapshot.accountStatus,
    payflowDetailsSubmitted: snapshot.detailsSubmitted,
    payflowChargesEnabled: snapshot.chargesEnabled,
    payflowPayoutsEnabled: snapshot.payoutsEnabled,
    payflowRequirementsCurrentlyDueJson: snapshot.requirementsCurrentlyDueJson,
    payflowRequirementsPastDueJson: snapshot.requirementsPastDueJson,
    payflowRequirementsPendingVerificationJson: snapshot.requirementsPendingVerificationJson,
    payflowCountry: snapshot.country,
    payflowDefaultCurrency: snapshot.defaultCurrency,
    payflowLastSyncedAt: snapshot.lastSyncedAt,
  });

  return { account, snapshot, saved };
}

function publicRecord(record: AppSettingsRecord) {
  return {
    _id: record._id,
    settingsKey: record.settingsKey,
    payflowProvider: record.payflowProvider,
    payflowEnvironment: record.payflowEnvironment,
    payflowAccountId: record.payflowAccountId,
    payflowAccountStatus: record.payflowAccountStatus,
    payflowDetailsSubmitted: record.payflowDetailsSubmitted,
    payflowChargesEnabled: record.payflowChargesEnabled,
    payflowPayoutsEnabled: record.payflowPayoutsEnabled,
    payflowRequirementsCurrentlyDueJson: record.payflowRequirementsCurrentlyDueJson,
    payflowRequirementsPastDueJson: record.payflowRequirementsPastDueJson,
    payflowRequirementsPendingVerificationJson: record.payflowRequirementsPendingVerificationJson,
    payflowCountry: record.payflowCountry,
    payflowDefaultCurrency: record.payflowDefaultCurrency,
    payflowLastSyncedAt: record.payflowLastSyncedAt,
  };
}

function handleError(error: unknown): Response {
  console.error('RentalFlow Stripe Connect API failed', error);
  if (error instanceof StripeConnectServerError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  const message = error instanceof Error ? error.message : 'Unexpected Stripe Connect error.';
  return json({ error: message }, 500);
}

export const GET: APIRoute = async () => {
  try {
    await requireDashboardUser();
    const record = await loadSettings();
    return json({
      ok: true,
      environments: {
        TEST: stripeConnectCredentials('TEST').configured,
        LIVE: stripeConnectCredentials('LIVE').configured,
      },
      record: publicRecord(record),
    });
  } catch (error) {
    return handleError(error);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const tokenInfo = await requireDashboardUser();
    let body: StripeRequestBody;
    try {
      body = await request.json() as StripeRequestBody;
    } catch {
      throw new StripeConnectServerError('Invalid JSON body.', 400, 'invalid_json');
    }

    const action = body.action;
    if (action !== 'connect' && action !== 'session' && action !== 'refresh') {
      throw new StripeConnectServerError('Unsupported Stripe Connect action.', 400, 'invalid_action');
    }

    const environment = normalizePaymentEnvironment(body.environment);
    const credentials = stripeConnectCredentials(environment);
    if (!credentials.configured) {
      throw new StripeConnectServerError(
        `Stripe ${environment.toLowerCase()} credentials are not configured for RentalFlow.`,
        503,
        'stripe_not_configured',
      );
    }

    const record = await loadSettings();

    if (action === 'refresh') {
      if (!record.payflowAccountId) {
        throw new StripeConnectServerError('No Stripe account is connected yet.', 404, 'stripe_account_missing');
      }
      if (environmentMismatch(record, environment)) {
        throw new StripeConnectServerError('The connected account belongs to another Stripe environment.', 409, 'stripe_environment_mismatch');
      }
      const account = await retrieveStripeConnectedAccount(environment, record.payflowAccountId);
      const snapshot = stripeAccountSnapshot(account);
      const saved = await saveSettings({
        ...record,
        payflowProvider: 'PAYFLOW_STRIPE',
        payflowEnvironment: environment,
        payflowAccountStatus: snapshot.accountStatus,
        payflowDetailsSubmitted: snapshot.detailsSubmitted,
        payflowChargesEnabled: snapshot.chargesEnabled,
        payflowPayoutsEnabled: snapshot.payoutsEnabled,
        payflowRequirementsCurrentlyDueJson: snapshot.requirementsCurrentlyDueJson,
        payflowRequirementsPastDueJson: snapshot.requirementsPastDueJson,
        payflowRequirementsPendingVerificationJson: snapshot.requirementsPendingVerificationJson,
        payflowCountry: snapshot.country,
        payflowDefaultCurrency: snapshot.defaultCurrency,
        payflowLastSyncedAt: snapshot.lastSyncedAt,
      });
      return json({ ok: true, record: publicRecord(saved) });
    }

    const ensured = await ensureAccount(record, environment, tokenInfo.instanceId);

    if (action === 'connect') {
      return json({
        ok: true,
        publishableKey: credentials.publishableKey,
        record: publicRecord(ensured.saved),
      });
    }

    const session = await createStripeAccountSession(environment, ensured.snapshot.accountId);
    return json({
      ok: true,
      clientSecret: session.clientSecret,
      expiresAt: session.expiresAt,
      publishableKey: session.publishableKey,
      record: publicRecord(ensured.saved),
    });
  } catch (error) {
    return handleError(error);
  }
};
