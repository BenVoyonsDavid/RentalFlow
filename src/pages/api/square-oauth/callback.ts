import type { APIRoute } from 'astro';
import {
  verifySquareOAuthState,
  SquareOAuthServerError,
} from '../../../lib/square-oauth-server';

function escapeHtml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char));
}

function htmlPage(
  ok: boolean,
  title: string,
  message: string,
  payload: Record<string, unknown>,
  detail = '',
): Response {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeDetail = escapeHtml(detail);
  const postMessagePayload = JSON.stringify({
    type: 'rentalflow-square-oauth',
    ok,
    ...payload,
  }).replace(/</g, '\\u003c');

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
<body><main><div class="badge">${ok ? 'RentalFlow · Autorisation reçue' : 'RentalFlow · Connexion Square'}</div><h1>${safeTitle}</h1><p>${safeMessage}</p>${safeDetail ? `<div class="detail">${safeDetail}</div>` : ''}</main>
<script>
(function(){
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(${postMessagePayload}, '*');
      ${ok ? "setTimeout(function(){ window.close(); }, 1800);" : ''}
    }
  } catch (e) {}
})();
</script>
</body></html>`, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
    },
  });
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const stateValue = url.searchParams.get('state') || '';

    if (!stateValue) {
      return htmlPage(
        false,
        'Test Square reçu',
        'Square a bien répondu, mais cette autorisation n’a pas été démarrée depuis RentalFlow.',
        {},
        'square_state_missing',
      );
    }

    const state = await verifySquareOAuthState(stateValue);
    const actualRedirectUri = `${url.origin}${url.pathname}`;
    if (state.redirectUri !== actualRedirectUri) {
      throw new SquareOAuthServerError(
        'OAuth callback URL does not match the signed RentalFlow request.',
        400,
        'square_redirect_mismatch',
      );
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
        { squareError },
        denied ? 'access_denied' : squareError,
      );
    }

    const code = url.searchParams.get('code') || '';
    if (!code) {
      throw new SquareOAuthServerError(
        'Square authorization code is missing.',
        400,
        'square_code_missing',
      );
    }

    return htmlPage(
      true,
      'Autorisation Square reçue',
      'RentalFlow termine maintenant la connexion de façon sécurisée dans votre tableau de bord Wix.',
      {
        code,
        state: stateValue,
        environment: state.environment,
      },
    );
  } catch (error) {
    console.error('RentalFlow Square OAuth callback failed', error);
    const detail = error instanceof SquareOAuthServerError
      ? error.code || 'square_oauth_error'
      : 'square_callback_error';
    return htmlPage(
      false,
      'Connexion Square impossible',
      'RentalFlow n’a pas pu valider le retour de Square. Fermez cette fenêtre et relancez la connexion depuis les paramètres de paiement.',
      {},
      detail,
    );
  }
};
