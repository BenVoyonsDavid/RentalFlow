import type { APIRoute } from 'astro';
import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import {
  encryptSquareSecret,
  getSquareAccountSnapshot,
  obtainSquareOAuthTokens,
  squareTokenExpiresAt,
  verifySquareOAuthState,
  SquareOAuthServerError,
  SQUARE_OAUTH_SCOPES,
} from '../../../lib/square-oauth-server';

const PAYMENT_ACCOUNTS = '@pilotedavid1/rental-flow/payment-accounts';
const PAYMENT_CREDENTIALS = '@pilotedavid1/rental-flow/payment-credentials';

type DataRecord = Record<string, unknown> & { _id?: string };

function htmlPage(ok: boolean, title: string, message: string, detail = ''): Response {
  const safeTitle = title.replace(/[<>&"']/g, '');
  const safeMessage = message.replace(/[<>&"']/g, '');
  const safeDetail = detail.replace(/[<>&"']/g, '');
  const payload = JSON.stringify({ type: 'rentalflow-square-oauth', ok });
  return new Response(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
<style>
body{font-family:Arial,sans-serif;background:#f8fafc;color:#172033;margin:0;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box}
main{max-width:620px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;box-shadow:0 8px 28px rgba(15,23,42,.08)}
h1{margin:0 0 12px;font-size:24px}p{line-height:1.55;color:#475569;margin:0}.detail{margin-top:14px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-family:monospace;font-size:12px;color:#475569}.badge{display:inline-block;margin-bottom:14px;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700;background:${ok ? '#dcfce7' : '#fee2e2'};color:${ok ? '#166534' : '#991b1b'}}
</style>
</head>
<body><main><div class="badge">${ok ? 'RentalFlow · Square connecté' : 'RentalFlow · Connexion Square'}</div><h1>${safeTitle}</h1><p>${safeMessage}</p>${safeDetail ? `<div class="detail">${safeDetail}</div>` : ''}</main>
<script>try{if(window.opener&&!window.opener.closed){window.opener.postMessage(${payload},'*');if(${ok ? 'true' : 'false'})setTimeout(function(){window.close()},1200)}}catch(e){}</script>
</body></html>`, {
    // OAuth callbacks are browser landing pages. Return a readable page even
    // when authorization failed; the actual outcome is carried in the page.
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
    },
  });
}

function elevatedQuery(collectionId: string): any {
  return auth.elevate(items.query)(collectionId);
}

async function elevatedInsert(collectionId: string, payload: DataRecord): Promise<DataRecord> {
  return auth.elevate(items.insert)(collectionId, payload) as Promise<DataRecord>;
}

async function elevatedUpdate(collectionId: string, payload: DataRecord): Promise<DataRecord> {
  return auth.elevate(items.update)(collectionId, payload) as Promise<DataRecord>;
}

async function upsertCredential(payload: DataRecord): Promise<void> {
  const key = String(payload.credentialKey || '');
  const result = await elevatedQuery(PAYMENT_CREDENTIALS).eq('credentialKey', key).limit(1).find();
  const existing = result.items?.[0] as DataRecord | undefined;
  if (existing?._id) await elevatedUpdate(PAYMENT_CREDENTIALS, { ...existing, ...payload, _id: existing._id });
  else await elevatedInsert(PAYMENT_CREDENTIALS, payload);
}

async function upsertPaymentAccount(payload: DataRecord): Promise<void> {
  const result = await elevatedQuery(PAYMENT_ACCOUNTS).eq('settingsKey', 'default').limit(1).find();
  const existing = result.items?.[0] as DataRecord | undefined;
  if (existing?._id) await elevatedUpdate(PAYMENT_ACCOUNTS, { ...existing, ...payload, _id: existing._id });
  else await elevatedInsert(PAYMENT_ACCOUNTS, payload);
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const stateValue = url.searchParams.get('state') || '';

    // The Developer Console's manual "Authorize test account" helper doesn't
    // start from RentalFlow, so it doesn't carry our signed state. Never accept
    // that callback as a connected RentalFlow merchant authorization.
    if (!stateValue) {
      return htmlPage(
        false,
        'Test Square reçu',
        'Square a bien accepté les permissions, mais cette autorisation a été lancée directement depuis Square. Pour connecter le marchand à RentalFlow, démarrez la connexion avec le bouton « Connecter Square » dans RentalFlow.',
        'square_state_missing',
      );
    }

    const state = await verifySquareOAuthState(stateValue);
    const actualRedirectUri = `${url.origin}${url.pathname}`;
    if (state.redirectUri !== actualRedirectUri) {
      throw new SquareOAuthServerError('OAuth callback URL does not match the signed RentalFlow request.', 400, 'square_redirect_mismatch');
    }

    const squareError = url.searchParams.get('error');
    if (squareError) {
      const denied = squareError === 'access_denied';
      return htmlPage(
        false,
        denied ? 'Autorisation annulée' : 'Connexion Square impossible',
        denied
          ? 'Aucune modification n’a été apportée. Vous pouvez fermer cette fenêtre et réessayer depuis RentalFlow.'
          : 'Square n’a pas pu autoriser RentalFlow. Fermez cette fenêtre et réessayez depuis les paramètres de paiement.',
        denied ? 'access_denied' : squareError,
      );
    }

    const code = url.searchParams.get('code') || '';
    if (!code) throw new SquareOAuthServerError('Square authorization code is missing.', 400, 'square_code_missing');

    const token = await obtainSquareOAuthTokens(state.environment, code, state.redirectUri);
    const snapshot = await getSquareAccountSnapshot(state.environment, token.access_token, token.merchant_id);
    const credentialKey = `PAYFLOW_SQUARE:${state.environment}`;

    await upsertCredential({
      credentialKey,
      provider: 'PAYFLOW_SQUARE',
      environment: state.environment,
      installationId: state.instanceId,
      merchantId: token.merchant_id,
      accessTokenEncrypted: await encryptSquareSecret(token.access_token),
      refreshTokenEncrypted: await encryptSquareSecret(token.refresh_token),
      tokenExpiresAt: squareTokenExpiresAt(token.expires_at),
      scopesJson: JSON.stringify(SQUARE_OAUTH_SCOPES),
      lastRefreshedAt: new Date(),
      active: true,
    });

    await upsertPaymentAccount({
      settingsKey: 'default',
      provider: 'PAYFLOW_SQUARE',
      environment: state.environment,
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

    return htmlPage(
      true,
      'Square est connecté à RentalFlow',
      'L’autorisation a été enregistrée de façon sécurisée. Cette fenêtre peut maintenant se fermer.',
    );
  } catch (error) {
    console.error('RentalFlow Square OAuth callback failed', error);
    const code = error instanceof SquareOAuthServerError ? error.code || 'square_oauth_error' : 'square_callback_error';
    return htmlPage(
      false,
      'Connexion Square impossible',
      'RentalFlow n’a pas pu terminer l’autorisation. Fermez cette fenêtre et relancez la connexion depuis les paramètres de paiement.',
      code,
    );
  }
};
