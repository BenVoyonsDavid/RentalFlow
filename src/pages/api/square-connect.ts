import type { APIRoute } from 'astro';
import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import { normalizePaymentEnvironment, type PaymentEnvironment } from '../../lib/payment-provider';
import {
  buildSquareAuthorizationUrl,
  decryptSquareSecret,
  encryptSquareSecret,
  getSquareAccountSnapshot,
  obtainSquareOAuthTokens,
  refreshSquareOAuthTokens,
  squareCredentials,
  squareTokenExpiresAt,
  verifySquareOAuthState,
  SquareOAuthServerError,
  SQUARE_OAUTH_SCOPES,
} from '../../lib/square-oauth-server';

const PAYMENT_ACCOUNTS = '@pilotedavid1/rental-flow/payment-accounts';
const PAYMENT_CREDENTIALS = '@pilotedavid1/rental-flow/payment-credentials';

const elevatedQuery = auth.elevate(items.query);
const elevatedInsert = auth.elevate(items.insert);
const elevatedUpdate = auth.elevate(items.update);

type DataRecord = Record<string, unknown> & { _id?: string };
type SquareAction = 'start' | 'refresh' | 'complete';

type SquareRequestBody = {
  action?: SquareAction;
  environment?: string;
  code?: string;
  state?: string;
};

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
  const instanceId = typeof tokenInfo.instanceId === 'string' ? tokenInfo.instanceId : '';
  if (!tokenInfo.active || tokenInfo.subjectType !== 'USER' || !instanceId) {
    throw new SquareOAuthServerError('Unauthorized dashboard request.', 403, 'unauthorized');
  }
  return { instanceId };
}

async function loadPaymentAccount(): Promise<DataRecord | null> {
  const result = await elevatedQuery(PAYMENT_ACCOUNTS).eq('settingsKey', 'default').limit(1).find();
  return (result.items?.[0] as DataRecord | undefined) || null;
}

async function upsertPaymentAccount(payload: DataRecord): Promise<DataRecord> {
  const existing = await loadPaymentAccount();
  if (existing?._id) return elevatedUpdate(PAYMENT_ACCOUNTS, { ...existing, ...payload, _id: existing._id }) as Promise<DataRecord>;
  return elevatedInsert(PAYMENT_ACCOUNTS, payload) as Promise<DataRecord>;
}

async function loadCredential(environment: PaymentEnvironment): Promise<DataRecord | null> {
  const credentialKey = `PAYFLOW_SQUARE:${environment}`;
  const result = await elevatedQuery(PAYMENT_CREDENTIALS).eq('credentialKey', credentialKey).limit(1).find();
  return (result.items?.[0] as DataRecord | undefined) || null;
}

async function saveCredential(existing: DataRecord | null, payload: DataRecord): Promise<DataRecord> {
  if (existing?._id) return elevatedUpdate(PAYMENT_CREDENTIALS, { ...existing, ...payload, _id: existing._id }) as Promise<DataRecord>;
  return elevatedInsert(PAYMENT_CREDENTIALS, payload) as Promise<DataRecord>;
}

function publicAccount(record: DataRecord | null) {
  if (!record) return null;
  return {
    _id: record._id,
    settingsKey: record.settingsKey,
    provider: record.provider,
    environment: record.environment,
    accountId: record.accountId,
    accountStatus: record.accountStatus,
    detailsSubmitted: record.detailsSubmitted,
    chargesEnabled: record.chargesEnabled,
    payoutsEnabled: record.payoutsEnabled,
    requirementsCurrentlyDueJson: record.requirementsCurrentlyDueJson,
    requirementsPastDueJson: record.requirementsPastDueJson,
    requirementsPendingVerificationJson: record.requirementsPendingVerificationJson,
    country: record.country,
    defaultCurrency: record.defaultCurrency,
    lastSyncedAt: record.lastSyncedAt,
    active: record.active,
  };
}

function callbackUrlFor(request: Request): string {
  const url = new URL(request.url);
  return `${url.origin}/api/square-oauth/callback`;
}

async function persistAuthorization(
  environment: PaymentEnvironment,
  instanceId: string,
  code: string,
): Promise<DataRecord> {
  const token = await obtainSquareOAuthTokens(environment, code);
  const snapshot = await getSquareAccountSnapshot(environment, token.access_token, token.merchant_id);
  const credentialKey = `PAYFLOW_SQUARE:${environment}`;
  const existingCredential = await loadCredential(environment);

  await saveCredential(existingCredential, {
    credentialKey,
    provider: 'PAYFLOW_SQUARE',
    environment,
    installationId: instanceId,
    merchantId: token.merchant_id,
    accessTokenEncrypted: await encryptSquareSecret(token.access_token),
    refreshTokenEncrypted: await encryptSquareSecret(token.refresh_token),
    tokenExpiresAt: squareTokenExpiresAt(token.expires_at),
    scopesJson: JSON.stringify(SQUARE_OAUTH_SCOPES),
    lastRefreshedAt: new Date(),
    active: true,
  });

  return upsertPaymentAccount({
    settingsKey: 'default',
    provider: 'PAYFLOW_SQUARE',
    environment,
    accountId: snapshot.accountId,
    accountStatus: snapshot.accountStatus,
    detailsSubmitted: snapshot.detailsSubmitted,
    chargesEnabled: snapshot.chargesEnabled,
    payoutsEnabled: snapshot.payoutsEnabled,
    requirementsCurrentlyDueJson: snapshot.requirementsCurrentlyDueJson,
    requirementsPastDueJson: snapshot.requirementsPastDueJson,
    requirementsPendingVerificationJson: snapshot.requirementsPendingVerificationJson,
    country: snapshot.country,
    defaultCurrency: snapshot.defaultCurrency,
    lastSyncedAt: snapshot.lastSyncedAt,
    active: true,
  });
}

async function refreshConnection(environment: PaymentEnvironment): Promise<DataRecord> {
  const credential = await loadCredential(environment);
  if (!credential) {
    throw new SquareOAuthServerError('No Square authorization is stored for this environment.', 404, 'square_authorization_missing');
  }

  let accessToken = await decryptSquareSecret(String(credential.accessTokenEncrypted || ''));
  let refreshToken = await decryptSquareSecret(String(credential.refreshTokenEncrypted || ''));
  if (!accessToken || !refreshToken) {
    throw new SquareOAuthServerError('Stored Square authorization is incomplete.', 500, 'square_authorization_incomplete');
  }

  const lastRefreshedAt = credential.lastRefreshedAt ? new Date(String(credential.lastRefreshedAt)) : null;
  const expiresAt = credential.tokenExpiresAt ? new Date(String(credential.tokenExpiresAt)) : null;
  const refreshAgeMs = lastRefreshedAt && Number.isFinite(lastRefreshedAt.getTime()) ? Date.now() - lastRefreshedAt.getTime() : Number.POSITIVE_INFINITY;
  const expiresSoon = expiresAt && Number.isFinite(expiresAt.getTime()) ? expiresAt.getTime() - Date.now() < 8 * 24 * 60 * 60 * 1000 : false;

  if (refreshAgeMs >= 6 * 24 * 60 * 60 * 1000 || expiresSoon) {
    const refreshed = await refreshSquareOAuthTokens(environment, refreshToken);
    accessToken = refreshed.access_token;
    refreshToken = refreshed.refresh_token;
    await saveCredential(credential, {
      ...credential,
      merchantId: refreshed.merchant_id,
      accessTokenEncrypted: await encryptSquareSecret(accessToken),
      refreshTokenEncrypted: await encryptSquareSecret(refreshToken),
      tokenExpiresAt: squareTokenExpiresAt(refreshed.expires_at),
      scopesJson: credential.scopesJson || JSON.stringify(SQUARE_OAUTH_SCOPES),
      lastRefreshedAt: new Date(),
      active: true,
    });
  }

  const merchantId = String(credential.merchantId || '');
  const snapshot = await getSquareAccountSnapshot(environment, accessToken, merchantId || undefined);
  return upsertPaymentAccount({
    settingsKey: 'default',
    provider: 'PAYFLOW_SQUARE',
    environment,
    accountId: snapshot.accountId,
    accountStatus: snapshot.accountStatus,
    detailsSubmitted: snapshot.detailsSubmitted,
    chargesEnabled: snapshot.chargesEnabled,
    payoutsEnabled: snapshot.payoutsEnabled,
    requirementsCurrentlyDueJson: snapshot.requirementsCurrentlyDueJson,
    requirementsPastDueJson: snapshot.requirementsPastDueJson,
    requirementsPendingVerificationJson: snapshot.requirementsPendingVerificationJson,
    country: snapshot.country,
    defaultCurrency: snapshot.defaultCurrency,
    lastSyncedAt: snapshot.lastSyncedAt,
    active: true,
  });
}

function handleError(error: unknown): Response {
  console.error('RentalFlow Square Connect API failed', error);
  if (error instanceof SquareOAuthServerError) return json({ error: error.message, code: error.code }, error.status);
  return json({ error: error instanceof Error ? error.message : 'Unexpected Square Connect error.' }, 500);
}

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireDashboardUser();
    const callbackUrl = callbackUrlFor(request);
    const account = await loadPaymentAccount();
    return json({
      ok: true,
      environments: {
        TEST: squareCredentials('TEST').configured,
        LIVE: squareCredentials('LIVE').configured,
      },
      callbackUrl,
      callbackIsHttps: callbackUrl.startsWith('https://'),
      account: publicAccount(account),
    });
  } catch (error) {
    return handleError(error);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { instanceId } = await requireDashboardUser();
    let body: SquareRequestBody;
    try {
      body = await request.json() as SquareRequestBody;
    } catch {
      throw new SquareOAuthServerError('Invalid JSON body.', 400, 'invalid_json');
    }

    const environment = normalizePaymentEnvironment(body.environment);
    if (body.action !== 'start' && body.action !== 'refresh' && body.action !== 'complete') {
      throw new SquareOAuthServerError('Unsupported Square Connect action.', 400, 'invalid_action');
    }
    if (!squareCredentials(environment).configured) {
      throw new SquareOAuthServerError(`Square ${environment.toLowerCase()} credentials are not configured for RentalFlow.`, 503, 'square_not_configured');
    }

    if (body.action === 'refresh') {
      const account = await refreshConnection(environment);
      return json({ ok: true, account: publicAccount(account) });
    }

    const callbackUrl = callbackUrlFor(request);
    if (!callbackUrl.startsWith('https://')) {
      throw new SquareOAuthServerError(
        'Square OAuth must use the Wix HTTPS preview or production endpoint, not localhost. Run npm run build then npm run preview.',
        409,
        'square_https_callback_required',
      );
    }

    if (body.action === 'complete') {
      const code = String(body.code || '').trim();
      const stateValue = String(body.state || '').trim();
      if (!code || !stateValue) {
        throw new SquareOAuthServerError('Square callback data is incomplete.', 400, 'square_callback_incomplete');
      }

      const state = await verifySquareOAuthState(stateValue);
      if (state.instanceId !== instanceId) {
        throw new SquareOAuthServerError('Square authorization belongs to a different RentalFlow installation.', 403, 'square_instance_mismatch');
      }
      if (state.environment !== environment) {
        throw new SquareOAuthServerError('Square authorization environment does not match RentalFlow.', 409, 'square_environment_mismatch');
      }
      if (state.redirectUri !== callbackUrl) {
        throw new SquareOAuthServerError('Square callback URL no longer matches this RentalFlow preview.', 409, 'square_redirect_mismatch');
      }

      const account = await persistAuthorization(environment, instanceId, code);
      return json({ ok: true, account: publicAccount(account) });
    }

    const authorizeUrl = await buildSquareAuthorizationUrl(environment, instanceId, callbackUrl);
    return json({ ok: true, authorizeUrl, callbackUrl });
  } catch (error) {
    return handleError(error);
  }
};
