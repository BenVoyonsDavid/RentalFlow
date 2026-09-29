import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import type { CatalogStockLock, ReservationItem } from '../domain/types';
import { COLLECTIONS } from '../lib/collection-ids';
import { collectAllPages } from '../lib/pagination';

const RESERVATION_ITEMS = COLLECTIONS.reservationItems;
const CATALOG_STOCK_LOCKS = COLLECTIONS.catalogStockLocks;
const STOCK_LOCK_TTL_MS = 2 * 60 * 1000;

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
  return query.find();
}

async function elevatedInsert(collectionId: string, item: Record<string, unknown>): Promise<any> {
  const insert = auth.elevate(items.insert);
  return insert(collectionId, item);
}

async function elevatedRemove(collectionId: string, itemId: string): Promise<any> {
  const remove = auth.elevate(items.remove);
  return remove(collectionId, itemId);
}

export async function loadCatalogBlockingItems(
  start: Date,
  end: Date,
  catalogItemIds: string[] = [],
): Promise<ReservationItem[]> {
  const loadForCatalogItem = async (catalogItemId?: string): Promise<ReservationItem[]> => collectAllPages(
    async (offset, limit) => {
      let query = elevatedQuery(RESERVATION_ITEMS)
        .lt('startDateTime', end)
        .gt('endDateTime', start);

      if (catalogItemId) query = query.eq('catalogItemId', catalogItemId);

      const result = await elevatedFind(query.skip(offset).limit(limit));
      return (result.items || []) as ReservationItem[];
    },
    1000,
  );

  const uniqueCatalogItemIds = [...new Set(catalogItemIds.filter(Boolean))];
  if (!uniqueCatalogItemIds.length) return loadForCatalogItem();

  const groups = await Promise.all(uniqueCatalogItemIds.map((catalogItemId) => loadForCatalogItem(catalogItemId)));
  return groups.flat();
}

export async function acquireCatalogStockLocks(catalogItemIds: string[]): Promise<CatalogStockLock[]> {
  const acquired: CatalogStockLock[] = [];
  const token = lockToken();
  const expiresAt = new Date(Date.now() + STOCK_LOCK_TTL_MS);

  try {
    for (const catalogItemId of [...new Set(catalogItemIds.filter(Boolean))].sort()) {
      const existingResult = await elevatedFind(
        elevatedQuery(CATALOG_STOCK_LOCKS).eq('catalogItemId', catalogItemId).limit(1),
      );
      const existing = existingResult.items?.[0] as CatalogStockLock | undefined;

      if (existing?._id) {
        const expiry = asDate(existing.expiresAt);
        if (expiry.getTime() && expiry.getTime() <= Date.now()) {
          await elevatedRemove(CATALOG_STOCK_LOCKS, existing._id);
        }
      }

      try {
        const created = await elevatedInsert(CATALOG_STOCK_LOCKS, { catalogItemId, lockToken: token, expiresAt });
        acquired.push(created as CatalogStockLock);
      } catch {
        throw new Error('CATALOG_STOCK_BUSY');
      }
    }

    return acquired;
  } catch (error) {
    for (const lock of acquired) {
      if (lock._id) await elevatedRemove(CATALOG_STOCK_LOCKS, lock._id).catch(() => undefined);
    }
    throw error;
  }
}

export async function releaseCatalogStockLocks(locks: CatalogStockLock[]): Promise<void> {
  for (const lock of locks) {
    if (lock._id) await elevatedRemove(CATALOG_STOCK_LOCKS, lock._id).catch(() => undefined);
  }
}
