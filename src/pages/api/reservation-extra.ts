import type { APIRoute } from 'astro';
import {
  ReservationExtraHttpError,
  type ReservationExtraRequest,
} from '../../lib/reservation-extra-contract';
import { mutateReservationExtra } from '../../server/reservation-extra-service';
import { requireDashboardUser } from '../../server/request-auth';

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
  try {
    await requireDashboardUser();

    const body = await request.json().catch(() => null) as ReservationExtraRequest | null;
    if (!body || typeof body !== 'object') {
      return json({ error: 'INVALID_REQUEST' }, 400);
    }

    const result = await mutateReservationExtra(body);
    return json(result, 200);
  } catch (error) {
    if (error instanceof ReservationExtraHttpError) {
      return json({
        error: error.code,
        message: error.message,
        ...(error.details || {}),
      }, error.status);
    }

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return json({ error: 'Forbidden' }, 403);
    }

    if (error instanceof Error && error.message === 'CATALOG_STOCK_BUSY') {
      return json({ error: 'CATALOG_STOCK_BUSY' }, 409);
    }

    if (error instanceof Error && error.message === 'RESERVATION_MUTATION_BUSY') {
      return json({ error: 'RESERVATION_MUTATION_BUSY' }, 409);
    }

    console.error('RentalFlow reservation extra mutation failed', error);
    return json({ error: 'RESERVATION_EXTRA_MUTATION_FAILED' }, 500);
  }
};
