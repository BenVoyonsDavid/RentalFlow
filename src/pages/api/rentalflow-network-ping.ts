import type { APIRoute } from 'astro';

function headers(request: Request): Record<string, string> {
  const origin = String(request.headers.get('origin') || '').trim();
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': origin || '*',
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'Authorization,Content-Type',
    'access-control-allow-credentials': origin ? 'true' : 'false',
    'access-control-max-age': '600',
    'vary': 'Origin',
  };
}

export const OPTIONS: APIRoute = async ({ request }) =>
  new Response(null, { status: 204, headers: headers(request) });

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  return new Response(JSON.stringify({
    ok: true,
    endpoint: 'rentalflow-network-ping',
    backendOrigin: url.origin,
    hasAuthorizationHeader: Boolean(request.headers.get('authorization')),
  }), {
    status: 200,
    headers: headers(request),
  });
};
