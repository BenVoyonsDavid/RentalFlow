import type { APIRoute } from 'astro';
import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import type { CatalogStockLock, Reservation, ReservationItem } from '../../domain/types';
import { activeCatalogReservedQuantity, availableCatalogStock } from '../../lib/catalog-inventory';
import { COLLECTIONS } from '../../lib/collection-ids';
import {
  catalogBillableDays,
  catalogItemToReservationLine,
  type CatalogReservationItem,
} from '../../lib/reservation-catalog';
import {
  acquireCatalogStockLocks,
  loadCatalogBlockingItems,
  releaseCatalogStockLocks,
} from '../../server/catalog-stock';

const RESERVATIONS = COLLECTIONS.reservations;
const RESERVATION_ITEMS = COLLECTIONS.reservationItems;
const CATALOG = COLLECTIONS.catalogItems;
const MAX_QUANTITY = 999;

type RequestBody = {
  reservationId?: string;
  catalogItemId?: string;
  quantityToAdd?: number;
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

function clean(value: unknown, max = 100): string {
  return String(value ?? '').trim().slice(0, max);
}

function asDate(value?: Date | string): Date {
  if (value instanceof Date) return value;
  return value ? new Date(value) : new Date(0);
}

function elevatedQuery(collectionId: string): any {
  const query = auth.elevate(items.query);
  return query(collectionId);
}

async function elevatedFind(query: any): Promise<any> {
  return query.find({ consistentRead: true });
}

async function elevatedInsert(collectionId: string, item: Record<string, unknown>): Promise<any> {
  const insert = auth.elevate(items.insert);
  return insert(collectionId, item);
}

async function elevatedUpdate(collectionId: string, item: Record<string, unknown>): Promise<any> {
  const update = auth.elevate(items.update);
  const itemId = item._id;
  if (typeof itemId !== 'string' || !itemId) throw new Error('MISSING_ITEM_ID');
  return update(collectionId, { ...item, _id: itemId });
}

async function requireAppInstance(): Promise<void> {
  const tokenInfo = await auth.getTokenInfo();
  if (!tokenInfo?.instanceId) throw new Error('UNAUTHORIZED');
}

export const POST: APIRoute = async ({ request }) => {
  let locks: CatalogStockLock[] = [];

  try {
    await requireAppInstance();

    const body = await request.json() as RequestBody;
    const reservationId = clean(body.reservationId, 80);
    const catalogItemId = clean(body.catalogItemId, 80);
    const quantityToAdd = Math.min(MAX_QUANTITY, Math.max(1, Math.floor(Number(body.quantityToAdd) || 1)));

    if (!reservationId || !catalogItemId) return json({ error: 'INVALID_REQUEST' }, 400);

    const [reservationResult, catalogResult] = await Promise.all([
      elevatedFind(elevatedQuery(RESERVATIONS).eq('_id', reservationId).limit(1)),
      elevatedFind(elevatedQuery(CATALOG).eq('_id', catalogItemId).limit(1)),
    ]);

    const reservation = reservationResult.items?.[0] as Reservation | undefined;
    const catalogItem = catalogResult.items?.[0] as CatalogReservationItem | undefined;

    if (!reservation?._id) return json({ error: 'RESERVATION_NOT_FOUND' }, 404);
    if (!catalogItem?._id || catalogItem.active === false) return json({ error: 'CATALOG_ITEM_NOT_FOUND' }, 404);
    if (reservation.status === 'CANCELLED' || reservation.status === 'COMPLETED') {
      return json({ error: 'RESERVATION_CLOSED' }, 409);
    }

    const start = asDate(reservation.startDateTime);
    const end = asDate(reservation.endDateTime);
    if (!start.getTime() || !end.getTime() || end <= start) return json({ error: 'INVALID_RESERVATION_PERIOD' }, 409);

    if (catalogItem.trackInventory === true) {
      locks = await acquireCatalogStockLocks([catalogItemId]);
    }

    const existingResult = await elevatedFind(
      elevatedQuery(RESERVATION_ITEMS)
        .eq('reservationId', reservationId)
        .eq('catalogItemId', catalogItemId)
        .limit(1),
    );
    const existing = existingResult.items?.[0] as ReservationItem | undefined;

    if (existing && (catalogItem.pricingMode === 'FIXED' || catalogItem.pricingMode === 'PER_RESERVATION')) {
      return json({ error: 'CATALOG_ITEM_ALREADY_PRESENT' }, 409);
    }

    const currentQuantity = Math.max(0, Math.floor(Number(existing?.quantity) || 0));
    const nextQuantity = currentQuantity + quantityToAdd;

    if (catalogItem.trackInventory === true) {
      const blockingItems = await loadCatalogBlockingItems(start, end, [catalogItemId]);
      const reservedByOtherReservations = activeCatalogReservedQuantity(
        blockingItems,
        catalogItemId,
        reservationId,
      );
      const availableForThisReservation = availableCatalogStock(
        catalogItem.stockQuantity,
        reservedByOtherReservations,
      );

      if (nextQuantity > availableForThisReservation) {
        return json({
          error: 'CATALOG_OUT_OF_STOCK',
          availableQuantity: availableForThisReservation,
          requestedQuantity: nextQuantity,
        }, 409);
      }
    }

    const billableDays = catalogBillableDays(start, end);
    const lineSnapshot = catalogItemToReservationLine(
      catalogItem,
      nextQuantity,
      billableDays,
      reservation.currency || catalogItem.currency || 'CAD',
    );

    let saved: ReservationItem;
    if (existing?._id) {
      saved = await elevatedUpdate(RESERVATION_ITEMS, {
        ...existing,
        ...lineSnapshot,
        _id: existing._id,
        reservationId,
        reservationNumber: reservation.reservationNumber || '',
        startDateTime: reservation.startDateTime,
        endDateTime: reservation.endDateTime,
        status: reservation.status || 'CONFIRMED',
      }) as ReservationItem;
    } else {
      saved = await elevatedInsert(RESERVATION_ITEMS, {
        ...lineSnapshot,
        reservationId,
        reservationNumber: reservation.reservationNumber || '',
        startDateTime: reservation.startDateTime,
        endDateTime: reservation.endDateTime,
        status: reservation.status || 'CONFIRMED',
      }) as ReservationItem;
    }

    return json({ item: saved }, 200);
  } catch (error) {
    console.error('RentalFlow reservation extra stock mutation failed', error);

    if (error instanceof Error && error.message === 'UNAUTHORIZED') return json({ error: 'Unauthorized' }, 401);
    if (error instanceof Error && error.message === 'CATALOG_STOCK_BUSY') {
      return json({ error: 'CATALOG_STOCK_BUSY' }, 409);
    }

    return json({ error: 'Unable to update reservation extra.' }, 500);
  } finally {
    await releaseCatalogStockLocks(locks);
  }
};
