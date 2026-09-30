import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import type { AssetCapacityLock } from '../domain/types';
import { COLLECTIONS } from '../lib/collection-ids';

const LOCKS = COLLECTIONS.assetCapacityLocks;
const LOCK_TTL_MS = 2 * 60 * 1000;

function asDate(value?: Date | string): Date {
  if (value instanceof Date) return value;
  return value ? new Date(value) : new Date(0);
}

function lockToken(): string {
  return globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

async function elevatedRemove(
  collectionId: string,
  itemId: string,
): Promise<any> {
  const remove = auth.elevate(items.remove);
  return remove(collectionId, itemId);
}

export async function acquireReservationMutationLock(
  reservationId: string,
): Promise<AssetCapacityLock> {
  const lockKey = `reservation-extra:${reservationId}`;
  const existingResult = await elevatedFind(
    elevatedQuery(LOCKS).eq('lockKey', lockKey).limit(1),
  );
  const existing = existingResult.items?.[0] as AssetCapacityLock | undefined;

  if (existing?._id) {
    const expiry = asDate(existing.expiresAt);
    if (expiry.getTime() && expiry.getTime() <= Date.now()) {
      await elevatedRemove(LOCKS, existing._id);
    }
  }

  try {
    return await elevatedInsert(LOCKS, {
      lockKey,
      lockToken: lockToken(),
      expiresAt: new Date(Date.now() + LOCK_TTL_MS),
    }) as AssetCapacityLock;
  } catch {
    throw new Error('RESERVATION_MUTATION_BUSY');
  }
}

export async function releaseReservationMutationLock(
  lock: AssetCapacityLock | null,
): Promise<void> {
  if (!lock?._id) return;
  await elevatedRemove(LOCKS, lock._id).catch(() => undefined);
}
