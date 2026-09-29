import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';
import {
  PublicBookingHttpError,
  type BookingRequest,
} from '../../lib/public-booking-contract';
import {
  loadPublicBooking,
  submitPublicBooking,
} from '../../server/public-booking-service';

function corsHeaders(request?: Request): Record<string, string> {
  const origin = String(request?.headers.get('origin') || '').trim();

  return {
    'access-control-allow-origin': origin || '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'Authorization,Content-Type',
    'access-control-allow-credentials': origin ? 'true' : 'false',
    'access-control-max-age': '600',
    vary: 'Origin',
  };
}

function json(
  data: unknown,
  status = 200,
  request?: Request,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...corsHeaders(request),
    },
  });
}

async function requireAppInstance(): Promise<void> {
  const tokenInfo = await auth.getTokenInfo();
  if (!tokenInfo?.instanceId) throw new Error('UNAUTHORIZED');
}

function knownErrorResponse(
  error: unknown,
  request: Request,
): Response | null {
  if (error instanceof PublicBookingHttpError) {
    return json({ error: error.message }, error.status, request);
  }

  if (!(error instanceof Error)) return null;

  if (error.message === 'UNAUTHORIZED') {
    return json({ error: 'Unauthorized' }, 401, request);
  }

  if (error.message === 'BOOKING_BUSY') {
    return json({
      error: 'Cette disponibilité est en cours de réservation. Réessayez dans quelques secondes.',
    }, 409, request);
  }

  if (error.message === 'CATALOG_STOCK_BUSY') {
    return json({
      error: 'Le stock d’un extra est en cours de réservation. Réessayez dans quelques secondes.',
    }, 409, request);
  }

  if (
    ['INVALID_PERIOD', 'PERIOD_TOO_LONG', 'PAST_PERIOD']
      .includes(error.message)
  ) {
    return json({ error: error.message }, 400, request);
  }

  if (error.message.startsWith('PAYLINK')) {
    return json({
      error: 'La réservation n’a pas été confirmée parce que le paiement Wix n’a pas pu être préparé.',
    }, 502, request);
  }

  return null;
}

export const OPTIONS: APIRoute = async ({ request }) =>
  new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAppInstance();
    const payload = await loadPublicBooking(request);
    return json(payload, 200, request);
  } catch (error) {
    const known = knownErrorResponse(error, request);
    if (known) return known;

    console.error('RentalFlow public booking GET failed', error);
    return json({
      error: 'Impossible de charger la réservation en ligne.',
    }, 500, request);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAppInstance();
    const body = await request.json() as BookingRequest;
    const payload = await submitPublicBooking(request, body);
    return json(payload, 201, request);
  } catch (error) {
    const known = knownErrorResponse(error, request);
    if (known) return known;

    console.error('RentalFlow public booking POST failed', error);
    return json({
      error: 'Impossible de compléter la réservation en ligne.',
    }, 500, request);
  }
};
