import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import type { Asset, AssetCapacityLock, AssetStatus } from '../domain/types';
import { COLLECTIONS } from '../lib/collection-ids';
import { collectAllPages } from '../lib/pagination';
import {
  assetLimitForPlan,
  canCreateAsset,
  hasFeature,
  planLabels,
  type RentalFlowPlan,
} from '../lib/plans';
import { loadCurrentPlan } from './public-booking-context';

const ASSETS = COLLECTIONS.assets;
const ASSET_CAPACITY_LOCKS = COLLECTIONS.assetCapacityLocks;
const CAPACITY_LOCK_KEY = 'active-assets';
const CAPACITY_LOCK_TTL_MS = 2 * 60 * 1000;

const ASSET_STATUSES = new Set<AssetStatus>([
  'AVAILABLE',
  'RESERVED',
  'RENTED',
  'MAINTENANCE',
  'INACTIVE',
]);

export class AssetWriteError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AssetWriteError';
    this.status = status;
  }
}

function clean(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

function nonNegativeInteger(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function nonNegativeNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

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

async function loadAsset(assetId: string): Promise<Asset | undefined> {
  if (!assetId) return undefined;

  const result = await elevatedFind(
    elevatedQuery(ASSETS)
      .eq('_id', assetId)
      .limit(1),
  );

  return result.items?.[0] as Asset | undefined;
}

async function activeAssetCount(): Promise<number> {
  const candidates = await collectAllPages(async (offset, limit) => {
    const result = await elevatedFind(
      elevatedQuery(ASSETS)
        .skip(offset)
        .limit(limit),
    );

    return (result.items || []) as Asset[];
  }, 1000);

  return candidates.filter(
    (asset) => asset.active !== false && asset.status !== 'INACTIVE',
  ).length;
}

async function acquireCapacityLock(): Promise<AssetCapacityLock> {
  const existingResult = await elevatedFind(
    elevatedQuery(ASSET_CAPACITY_LOCKS)
      .eq('lockKey', CAPACITY_LOCK_KEY)
      .limit(1),
  );
  const existing = existingResult.items?.[0] as AssetCapacityLock | undefined;

  if (existing?._id) {
    const expiry = asDate(existing.expiresAt);
    if (expiry.getTime() && expiry.getTime() <= Date.now()) {
      await elevatedRemove(ASSET_CAPACITY_LOCKS, existing._id);
    }
  }

  try {
    return await elevatedInsert(ASSET_CAPACITY_LOCKS, {
      lockKey: CAPACITY_LOCK_KEY,
      lockToken: lockToken(),
      expiresAt: new Date(Date.now() + CAPACITY_LOCK_TTL_MS),
    }) as AssetCapacityLock;
  } catch {
    throw new AssetWriteError(
      409,
      'La limite d’équipements est en cours de mise à jour. Réessayez dans quelques secondes.',
    );
  }
}

async function releaseCapacityLock(lock?: AssetCapacityLock): Promise<void> {
  if (!lock?._id) return;
  await elevatedRemove(ASSET_CAPACITY_LOCKS, lock._id).catch(() => undefined);
}

function normalizeStatus(value: unknown): AssetStatus {
  const status = clean(value, 30).toUpperCase() as AssetStatus;
  return ASSET_STATUSES.has(status) ? status : 'AVAILABLE';
}

function applyPlanRules(
  input: Asset,
  plan: RentalFlowPlan,
): Asset {
  const status = normalizeStatus(input.status);
  const discountPercent = hasFeature(plan, 'LONG_TERM_DISCOUNT')
    ? nonNegativeNumber(input.discountPercent)
    : 0;

  if (discountPercent > 100) {
    throw new AssetWriteError(
      400,
      'Le rabais ne peut pas dépasser 100 %.',
    );
  }

  return {
    title: clean(input.title, 200),
    assetNumber: clean(input.assetNumber, 100).toUpperCase(),
    productType: clean(input.productType, 120),
    categoryId: clean(input.categoryId, 100),
    categoryName: clean(input.categoryName, 150),
    catalogTagsJson: clean(input.catalogTagsJson || '[]', 5000) || '[]',
    status,
    dailyRateCents: nonNegativeInteger(input.dailyRateCents),
    weeklyRateCents: hasFeature(plan, 'WEEKLY_PRICING')
      ? nonNegativeInteger(input.weeklyRateCents)
      : 0,
    monthlyRateCents: hasFeature(plan, 'MONTHLY_PRICING')
      ? nonNegativeInteger(input.monthlyRateCents)
      : 0,
    discountAfterDays: hasFeature(plan, 'LONG_TERM_DISCOUNT')
      ? nonNegativeInteger(input.discountAfterDays)
      : 0,
    discountPercent,
    currency: clean(input.currency || 'CAD', 10).toUpperCase() || 'CAD',
    serialNumber: clean(input.serialNumber, 150),
    image: input.image,
    notes: clean(input.notes, 5000),
    active: status !== 'INACTIVE',
  };
}

async function assertAssetNumberAvailable(
  assetNumber: string,
  editingId?: string,
): Promise<void> {
  const result = await elevatedFind(
    elevatedQuery(ASSETS)
      .eq('assetNumber', assetNumber)
      .limit(5),
  );

  const conflict = (result.items as Asset[])
    .some((asset) => asset._id !== editingId);

  if (conflict) {
    throw new AssetWriteError(
      409,
      `Le numéro d’actif ${assetNumber} existe déjà.`,
    );
  }
}

async function assertCapacityAvailable(plan: RentalFlowPlan): Promise<void> {
  const count = await activeAssetCount();

  if (!canCreateAsset(plan, count)) {
    const limit = assetLimitForPlan(plan);
    throw new AssetWriteError(
      409,
      `Limite atteinte : le plan ${planLabels[plan]} permet ${limit ?? 'un nombre illimité de'} équipements actifs.`,
    );
  }
}

export async function saveAssetWithPlan(
  request: Request,
  assetId: string | undefined,
  input: Asset,
): Promise<Asset> {
  const plan = await loadCurrentPlan(request);
  const existing = assetId ? await loadAsset(assetId) : undefined;

  if (assetId && !existing?._id) {
    throw new AssetWriteError(404, 'Équipement introuvable.');
  }

  const payload = applyPlanRules(
    {
      ...(existing || {}),
      ...input,
    },
    plan,
  );

  if (!payload.title) {
    throw new AssetWriteError(
      400,
      'Le nom de l’équipement est obligatoire.',
    );
  }

  if (!payload.assetNumber) {
    throw new AssetWriteError(
      400,
      'Le numéro d’actif est obligatoire.',
    );
  }

  await assertAssetNumberAvailable(payload.assetNumber, existing?._id);

  const wasActive = existing
    ? existing.active !== false && existing.status !== 'INACTIVE'
    : false;
  const willBeActive = payload.active !== false
    && payload.status !== 'INACTIVE';
  const consumesNewCapacity = willBeActive && !wasActive;

  let capacityLock: AssetCapacityLock | undefined;

  try {
    if (consumesNewCapacity) {
      capacityLock = await acquireCapacityLock();
      await assertCapacityAvailable(plan);
    }

    if (existing?._id) {
      return await elevatedUpdate(ASSETS, {
        ...existing,
        ...payload,
        _id: existing._id,
      }) as Asset;
    }

    return await elevatedInsert(ASSETS, payload) as Asset;
  } catch (error) {
    if (error instanceof AssetWriteError) throw error;

    const message = error instanceof Error ? error.message : String(error || '');
    if (/unique|duplicate|already exists/i.test(message)) {
      throw new AssetWriteError(
        409,
        `Le numéro d’actif ${payload.assetNumber} existe déjà.`,
      );
    }

    throw error;
  } finally {
    await releaseCapacityLock(capacityLock);
  }
}
