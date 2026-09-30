import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import type { BookingLock, ReservationItem } from '../domain/types';
import { COLLECTIONS } from '../lib/collection-ids';
import { collectAllPages } from '../lib/pagination';
import { getBlockedRange } from '../lib/rental-pricing';

const RESERVATION_ITEMS = COLLECTIONS.reservationItems;
const BOOKING_LOCKS = COLLECTIONS.bookingLocks;
const BOOKING_LOCK_TTL_MS = 2 * 60 * 1000;

function asDate(value?: Date | string): Date {
  if (value instanceof Date) return value;
  return value ? new Date(value) : new Date(0);
}

function lockToken(): string {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

async function elevatedRemove(collectionId: string, itemId: string): Promise<any> {
  const remove = auth.elevate(items.remove);
  return remove(collectionId, itemId);
}

export async function loadBlockingItems(
  start: Date,
  end: Date,
  beforeHours: number,
  afterHours: number,
  assetIds: string[] = [],
): Promise<ReservationItem[]> {
  const requested = getBlockedRange(start, end, beforeHours, afterHours);

  const loadForAsset = async (assetId?: string): Promise<ReservationItem[]> => collectAllPages(
    async (offset, limit) => {
      let query = elevatedQuery(RESERVATION_ITEMS)
        .lt('blockedStartDateTime', requested.blockedEnd)
        .gt('blockedEndDateTime', requested.blockedStart);

      if (assetId) query = query.eq('assetId', assetId);

      const result = await elevatedFind(query.skip(offset).limit(limit));
      return (result.items || []) as ReservationItem[];
    },
    1000,
  );

  const uniqueAssetIds = [...new Set(assetIds.filter(Boolean))];
  if (!uniqueAssetIds.length) return loadForAsset();

  const groups = await Promise.all(uniqueAssetIds.map((assetId) => loadForAsset(assetId)));
  return groups.flat();
}

export async function acquireBookingLocks(assetIds: string[]): Promise<BookingLock[]> {
  const acquired: BookingLock[] = [];
  const token = lockToken();
  const expiresAt = new Date(Date.now() + BOOKING_LOCK_TTL_MS);

  try {
    for (const assetId of [...new Set(assetIds.filter(Boolean))].sort()) {
      const existingResult = await elevatedFind(
        elevatedQuery(BOOKING_LOCKS).eq('assetId', assetId).limit(1),
      );
      const existing = existingResult.items?.[0] as BookingLock | undefined;

      if (existing?._id) {
        const expiry = asDate(existing.expiresAt);
        if (expiry.getTime() && expiry.getTime() <= Date.now()) {
          await elevatedRemove(BOOKING_LOCKS, existing._id);
        }
      }

      try {
        const created = await elevatedInsert(BOOKING_LOCKS, { assetId, lockToken: token, expiresAt });
        acquired.push(created as BookingLock);
      } catch {
        throw new Error('BOOKING_BUSY');
      }
    }

    return acquired;
  } catch (error) {
    for (const lock of acquired) {
      if (lock._id) await elevatedRemove(BOOKING_LOCKS, lock._id).catch(() => undefined);
    }
    throw error;
  }
}

export async function releaseBookingLocks(locks: BookingLock[]): Promise<void> {
  for (const lock of locks) {
    if (lock._id) await elevatedRemove(BOOKING_LOCKS, lock._id).catch(() => undefined);
  }
}
