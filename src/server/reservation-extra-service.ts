import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import type {
  AppSettings,
  Asset,
  AssetCapacityLock,
  CatalogStockLock,
  Payment,
  Reservation,
  ReservationItem,
} from '../domain/types';
import { catalogItemAppliesToAnyAsset } from '../lib/catalog-compatibility';
import {
  activeCatalogReservedQuantity,
  availableCatalogStock,
} from '../lib/catalog-inventory';
import { COLLECTIONS } from '../lib/collection-ids';
import { collectAllPages } from '../lib/pagination';
import {
  ReservationExtraHttpError,
  type ReservationExtraRequest,
  type ReservationExtraSuccess,
} from '../lib/reservation-extra-contract';
import {
  catalogBillableDays,
  catalogItemToReservationLine,
  computeReservationFinancials,
  reservationLineType,
  type CatalogReservationItem,
} from '../lib/reservation-catalog';
import {
  acquireCatalogStockLocks,
  loadCatalogBlockingItems,
  releaseCatalogStockLocks,
} from './catalog-stock';
import {
  loadSettingsAndTemplates,
} from './public-booking-context';
import {
  acquireReservationMutationLock,
  releaseReservationMutationLock,
} from './reservation-mutation-lock';

const ACTIVITY = COLLECTIONS.activityLog;
const ASSETS = COLLECTIONS.assets;
const CATALOG = COLLECTIONS.catalogItems;
const PAYMENTS = COLLECTIONS.payments;
const RESERVATIONS = COLLECTIONS.reservations;
const RESERVATION_ITEMS = COLLECTIONS.reservationItems;
const MAX_QUANTITY = 999;

type AppliedLineMutation =
  | {
      kind: 'INSERT';
      saved: ReservationItem;
    }
  | {
      kind: 'UPDATE';
      before: ReservationItem;
      saved: ReservationItem;
    };

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

async function elevatedInsert(
  collectionId: string,
  item: Record<string, unknown>,
): Promise<any> {
  const insert = auth.elevate(items.insert);
  return insert(collectionId, item);
}

async function elevatedUpdate(
  collectionId: string,
  item: Record<string, unknown>,
): Promise<any> {
  const update = auth.elevate(items.update);
  const itemId = item._id;
  if (typeof itemId !== 'string' || !itemId) {
    throw new Error('MISSING_ITEM_ID');
  }
  return update(collectionId, { ...item, _id: itemId });
}

async function elevatedRemove(
  collectionId: string,
  itemId: string,
): Promise<any> {
  const remove = auth.elevate(items.remove);
  return remove(collectionId, itemId);
}

function writableReservation(
  reservation: Reservation,
  changes: Partial<Reservation>,
): Record<string, unknown> {
  const {
    _createdDate,
    _updatedDate,
    ...rest
  } = reservation;

  return {
    ...rest,
    _id: reservation._id,
    ...changes,
  };
}

function writableReservationItem(
  line: ReservationItem,
  changes: Partial<ReservationItem> = {},
): Record<string, unknown> {
  const {
    _createdDate,
    _updatedDate,
    ...rest
  } = line;

  return {
    ...rest,
    _id: line._id,
    ...changes,
  };
}

function netPaidCents(payments: Payment[]): number {
  return payments.reduce((sum, payment) => {
    if (payment.status !== 'PAID') return sum;

    const amount = Math.max(
      0,
      Math.round(Number(payment.amountCents) || 0),
    );

    if (
      payment.paymentType === 'PAYMENT'
      || payment.paymentType === 'BOOKING_DEPOSIT'
    ) {
      return sum + amount;
    }

    if (payment.paymentType === 'REFUND') {
      return sum - amount;
    }

    return sum;
  }, 0);
}

function activeReservationLines(
  lines: ReservationItem[],
): ReservationItem[] {
  return lines.filter(
    (line) =>
      line.status !== 'CANCELLED'
      && line.status !== 'COMPLETED',
  );
}

async function loadReservation(
  reservationId: string,
): Promise<Reservation> {
  const result = await elevatedFind(
    elevatedQuery(RESERVATIONS)
      .eq('_id', reservationId)
      .limit(1),
  );
  const reservation = result.items?.[0] as Reservation | undefined;

  if (!reservation?._id) {
    throw new ReservationExtraHttpError(
      404,
      'RESERVATION_NOT_FOUND',
      'Réservation introuvable.',
    );
  }

  if (
    reservation.status === 'CANCELLED'
    || reservation.status === 'COMPLETED'
    || reservation.status === 'ERROR'
  ) {
    throw new ReservationExtraHttpError(
      409,
      'RESERVATION_CLOSED',
      'Cette réservation ne peut plus être modifiée.',
    );
  }

  return reservation;
}

async function loadReservationItems(
  reservationId: string,
): Promise<ReservationItem[]> {
  return collectAllPages(async (offset, limit) => {
    const result = await elevatedFind(
      elevatedQuery(RESERVATION_ITEMS)
        .eq('reservationId', reservationId)
        .skip(offset)
        .limit(limit),
    );
    return (result.items || []) as ReservationItem[];
  }, 1000);
}

async function loadReservationPayments(
  reservationId: string,
): Promise<Payment[]> {
  return collectAllPages(async (offset, limit) => {
    const result = await elevatedFind(
      elevatedQuery(PAYMENTS)
        .eq('reservationId', reservationId)
        .skip(offset)
        .limit(limit),
    );
    return (result.items || []) as Payment[];
  }, 1000);
}

async function findCatalogItem(
  catalogItemId: string,
): Promise<CatalogReservationItem | undefined> {
  const result = await elevatedFind(
    elevatedQuery(CATALOG)
      .eq('_id', catalogItemId)
      .limit(1),
  );
  return result.items?.[0] as CatalogReservationItem | undefined;
}

async function loadActiveCatalogItem(
  catalogItemId: string,
): Promise<CatalogReservationItem> {
  const item = await findCatalogItem(catalogItemId);

  if (!item?._id || item.active === false) {
    throw new ReservationExtraHttpError(
      404,
      'CATALOG_ITEM_NOT_FOUND',
      'Article catalogue introuvable ou inactif.',
    );
  }

  return item;
}

async function loadAssetsByIds(
  assetIds: string[],
): Promise<Asset[]> {
  const uniqueIds = [...new Set(assetIds.filter(Boolean))];
  const results = await Promise.all(
    uniqueIds.map((assetId) =>
      elevatedFind(
        elevatedQuery(ASSETS)
          .eq('_id', assetId)
          .limit(1),
      ),
    ),
  );

  return results
    .map((result) => result.items?.[0] as Asset | undefined)
    .filter((asset): asset is Asset => !!asset?._id);
}

async function rollbackLineMutation(
  mutation: AppliedLineMutation | null,
): Promise<void> {
  if (!mutation) return;

  try {
    if (mutation.kind === 'INSERT') {
      if (mutation.saved._id) {
        await elevatedRemove(
          RESERVATION_ITEMS,
          mutation.saved._id,
        );
      }
      return;
    }

    await elevatedUpdate(
      RESERVATION_ITEMS,
      writableReservationItem(mutation.before),
    );
  } catch (error) {
    console.error(
      'RentalFlow reservation extra rollback failed.',
      error,
    );
  }
}

async function logMutation(
  reservation: Reservation,
  description: string,
): Promise<void> {
  try {
    await elevatedInsert(ACTIVITY, {
      reservationId: reservation._id,
      reservationNumber: reservation.reservationNumber || '',
      actionType: 'CATALOG_ITEMS_UPDATED',
      description,
      actor: 'Utilisateur Wix',
      eventDate: new Date(),
    });
  } catch (error) {
    console.error(
      'RentalFlow could not log reservation extra mutation.',
      error,
    );
  }
}

function financeChanges(
  reservation: Reservation,
  lines: ReservationItem[],
  payments: Payment[],
  settings: AppSettings,
): Partial<Reservation> {
  const finance = computeReservationFinancials(
    activeReservationLines(lines),
    reservation.customerDiscountPercent || 0,
    settings,
  );
  const totalCents = finance.totalCents;
  const paidCents = Math.max(0, netPaidCents(payments));

  return {
    subtotalCents: finance.subtotalCents,
    discountCents: finance.discountCents,
    preTaxTotalCents: finance.preTaxTotalCents,
    tax1Cents: finance.tax1Cents,
    tax2Cents: finance.tax2Cents,
    taxTotalCents: finance.taxTotalCents,
    totalCents,
    depositAmountCents: Math.min(
      reservation.depositAmountCents || 0,
      totalCents,
    ),
    amountDueNowCents: Math.min(
      reservation.amountDueNowCents || 0,
      totalCents,
    ),
    balanceDueCents: Math.max(0, totalCents - paidCents),
  };
}

export async function mutateReservationExtra(
  body: ReservationExtraRequest,
): Promise<ReservationExtraSuccess> {
  const action = body.action === 'REMOVE'
    ? 'REMOVE'
    : 'ADD';
  const reservationId = clean(body.reservationId, 80);

  if (!reservationId) {
    throw new ReservationExtraHttpError(
      400,
      'INVALID_REQUEST',
      'Réservation invalide.',
    );
  }

  let reservationLock: AssetCapacityLock | null = null;
  let stockLocks: CatalogStockLock[] = [];
  let appliedMutation: AppliedLineMutation | null = null;

  try {
    reservationLock = await acquireReservationMutationLock(
      reservationId,
    );

    const reservation = await loadReservation(reservationId);
    const [
      allLines,
      payments,
      { settings },
    ] = await Promise.all([
      loadReservationItems(reservationId),
      loadReservationPayments(reservationId),
      loadSettingsAndTemplates(),
    ]);

    const activeLines = activeReservationLines(allLines);
    const rentalAssetIds = activeLines
      .filter((line) => reservationLineType(line) === 'RENTAL')
      .map((line) => line.assetId || '')
      .filter(Boolean);

    let catalogItem: CatalogReservationItem;
    let nextLines: ReservationItem[];
    let resultItem: ReservationItem | undefined;
    let removedItemId: string | undefined;
    let activityDescription = '';

    if (action === 'ADD') {
      const catalogItemId = clean(body.catalogItemId, 80);
      if (!catalogItemId) {
        throw new ReservationExtraHttpError(
          400,
          'INVALID_REQUEST',
          'Article catalogue invalide.',
        );
      }

      catalogItem = await loadActiveCatalogItem(catalogItemId);
      const rentalAssets = await loadAssetsByIds(rentalAssetIds);

      if (!rentalAssets.length) {
        throw new ReservationExtraHttpError(
          409,
          'RESERVATION_HAS_NO_ASSETS',
          'Aucun équipement n’est lié à cette réservation.',
        );
      }

      if (
        !catalogItemAppliesToAnyAsset(
          catalogItem as any,
          rentalAssets,
        )
      ) {
        throw new ReservationExtraHttpError(
          409,
          'CATALOG_ITEM_INCOMPATIBLE',
          'Cet article n’est pas compatible avec les équipements de la réservation.',
        );
      }

      if (catalogItem.trackInventory === true) {
        stockLocks = await acquireCatalogStockLocks(
          [catalogItemId],
        );
      }

      const existing = activeLines.find(
        (line) =>
          reservationLineType(line) !== 'RENTAL'
          && line.catalogItemId === catalogItemId,
      );

      if (
        existing
        && (
          catalogItem.pricingMode === 'FIXED'
          || catalogItem.pricingMode === 'PER_RESERVATION'
        )
      ) {
        throw new ReservationExtraHttpError(
          409,
          'CATALOG_ITEM_ALREADY_PRESENT',
          'Cet article est déjà présent sur la réservation.',
        );
      }

      const requestedQuantity = Math.min(
        MAX_QUANTITY,
        Math.max(
          1,
          Math.floor(Number(body.quantityToAdd) || 1),
        ),
      );
      const currentQuantity = Math.max(
        0,
        Math.floor(Number(existing?.quantity) || 0),
      );
      const nextQuantity = currentQuantity + requestedQuantity;

      const start = asDate(reservation.startDateTime);
      const end = asDate(reservation.endDateTime);
      if (
        !start.getTime()
        || !end.getTime()
        || end <= start
      ) {
        throw new ReservationExtraHttpError(
          409,
          'INVALID_RESERVATION_PERIOD',
          'La période de la réservation est invalide.',
        );
      }

      if (catalogItem.trackInventory === true) {
        const blockingItems = await loadCatalogBlockingItems(
          start,
          end,
          [catalogItemId],
        );
        const reservedByOthers =
          activeCatalogReservedQuantity(
            blockingItems,
            catalogItemId,
            reservationId,
          );
        const availableForReservation =
          availableCatalogStock(
            catalogItem.stockQuantity,
            reservedByOthers,
          );

        if (nextQuantity > availableForReservation) {
          throw new ReservationExtraHttpError(
            409,
            'CATALOG_OUT_OF_STOCK',
            'Stock insuffisant.',
            {
              availableQuantity: availableForReservation,
              requestedQuantity: nextQuantity,
            },
          );
        }
      }

      const lineSnapshot = catalogItemToReservationLine(
        catalogItem,
        nextQuantity,
        catalogBillableDays(start, end),
        reservation.currency
          || catalogItem.currency
          || settings.currency
          || 'CAD',
      );

      if (existing?._id) {
        const saved = await elevatedUpdate(
          RESERVATION_ITEMS,
          {
            ...writableReservationItem(existing),
            ...lineSnapshot,
            _id: existing._id,
            reservationId,
            reservationNumber:
              reservation.reservationNumber || '',
            startDateTime: reservation.startDateTime,
            endDateTime: reservation.endDateTime,
            status: reservation.status || 'CONFIRMED',
          },
        ) as ReservationItem;

        appliedMutation = {
          kind: 'UPDATE',
          before: existing,
          saved,
        };
        resultItem = saved;
        nextLines = allLines.map(
          (line) => line._id === saved._id ? saved : line,
        );
      } else {
        const saved = await elevatedInsert(
          RESERVATION_ITEMS,
          {
            ...lineSnapshot,
            reservationId,
            reservationNumber:
              reservation.reservationNumber || '',
            startDateTime: reservation.startDateTime,
            endDateTime: reservation.endDateTime,
            status: reservation.status || 'CONFIRMED',
          },
        ) as ReservationItem;

        appliedMutation = {
          kind: 'INSERT',
          saved,
        };
        resultItem = saved;
        nextLines = [...allLines, saved];
      }

      activityDescription =
        `${catalogItem.name || 'Article'} ajouté à la réservation.`;
    } else {
      const reservationItemId = clean(
        body.reservationItemId,
        80,
      );
      if (!reservationItemId) {
        throw new ReservationExtraHttpError(
          400,
          'INVALID_REQUEST',
          'Ligne de réservation invalide.',
        );
      }

      const existing = activeLines.find(
        (line) =>
          line._id === reservationItemId
          && reservationLineType(line) !== 'RENTAL',
      );

      if (!existing?._id || !existing.catalogItemId) {
        throw new ReservationExtraHttpError(
          404,
          'RESERVATION_EXTRA_NOT_FOUND',
          'Extra de réservation introuvable.',
        );
      }

      const existingCatalogItem = await findCatalogItem(
        existing.catalogItemId,
      );

      if (existingCatalogItem?.trackInventory === true) {
        stockLocks = await acquireCatalogStockLocks(
          [existing.catalogItemId],
        );
      }

      const saved = await elevatedUpdate(
        RESERVATION_ITEMS,
        writableReservationItem(existing, {
          status: 'CANCELLED',
        }),
      ) as ReservationItem;

      appliedMutation = {
        kind: 'UPDATE',
        before: existing,
        saved,
      };
      removedItemId = existing._id;
      nextLines = allLines.map(
        (line) => line._id === saved._id ? saved : line,
      );
      activityDescription =
        `${existing.itemName || 'Article'} retiré de la réservation.`;
    }

    const updatedReservation = await elevatedUpdate(
      RESERVATIONS,
      writableReservation(
        reservation,
        financeChanges(
          reservation,
          nextLines,
          payments,
          settings,
        ),
      ),
    ) as Reservation;

    await logMutation(
      updatedReservation,
      activityDescription,
    );

    return {
      reservation: updatedReservation,
      item: resultItem,
      removedItemId,
    };
  } catch (error) {
    if (appliedMutation) {
      await rollbackLineMutation(appliedMutation);
    }
    throw error;
  } finally {
    await releaseCatalogStockLocks(stockLocks);
    await releaseReservationMutationLock(reservationLock);
  }
}
