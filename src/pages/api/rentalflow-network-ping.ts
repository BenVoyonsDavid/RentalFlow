import type { APIRoute } from 'astro';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers': 'Authorization,Content-Type',
  'cache-control': 'no-store',
};

export const OPTIONS: APIRoute = async () =>
  new Response(null, { status: 204, headers: CORS });

export const GET: APIRoute = async () =>
  new Response(JSON.stringify({ ok: true, endpoint: 'rentalflow-network-ping' }), {
    status: 200,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
  });
