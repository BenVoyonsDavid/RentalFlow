import type { APIRoute } from 'astro';
import { normalizeBiEventInput, sendBiEventToWix } from '../../lib/bi-events';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization) return json({ error: 'Unauthorized' }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const event = normalizeBiEventInput(body);
  if (!event) return json({ error: 'Unsupported BI event' }, 400);

  try {
    await sendBiEventToWix(authorization, event);
    return json({ ok: true });
  } catch (error) {
    console.error('RentalFlow BI event failed', error);
    return json({ error: 'Unable to send BI event' }, 502);
  }
};
