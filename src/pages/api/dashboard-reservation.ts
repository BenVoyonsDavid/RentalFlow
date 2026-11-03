import type { APIRoute } from 'astro';
import {
  DashboardReservationHttpError,
  type DashboardReservationRequest,
} from '../../lib/dashboard-reservation-contract';
import { createDashboardReservation } from '../../server/dashboard-reservation-service';
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

    const body = await request.json().catch(() => null) as DashboardReservationRequest | null;
    if (!body || typeof body !== 'object') {
      return json({ error: 'Requête de réservation invalide.' }, 400);
    }

    const result = await createDashboardReservation(request, body);

    return json(result, 201);
  } catch (error) {
    if (error instanceof DashboardReservationHttpError) {
      return json({ error: error.message }, error.status);
    }

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return json({ error: 'Forbidden' }, 403);
    }

    if (error instanceof Error && error.message === 'BOOKING_BUSY') {
      return json({
        error: 'Un équipement sélectionné est en cours de réservation. Réessayez dans quelques secondes.',
      }, 409);
    }

    console.error('RentalFlow dashboard reservation creation failed', error);
    return json({
      error: 'Impossible de créer la réservation.',
    }, 500);
  }
};
