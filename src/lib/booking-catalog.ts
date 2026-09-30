import type { Asset, ReservationItem } from '../domain/types';
import { activeCatalogReservedQuantity, availableCatalogStock } from './catalog-inventory';
import {
  catalogItemAppliesToAnyAsset,
  type CatalogCompatibilityRule,
} from './catalog-compatibility';
import {
  catalogBillableDays,
  catalogItemToReservationLine,
  type CatalogReservationItem,
  type ReservationCatalogLine,
} from './reservation-catalog';

export const MAX_PUBLIC_CATALOG_ITEMS = 50;
export const MAX_CATALOG_QUANTITY = 999;

export type BookingCatalogItem = CatalogReservationItem & CatalogCompatibilityRule & {
  image?: unknown;
};

export type PublicCatalogSelection = {
  id?: string;
  quantity?: number;
};

export function parseCatalogSelections(
  raw: PublicCatalogSelection[] | undefined,
): Map<string, number> {
  if (!Array.isArray(raw) || raw.length > MAX_PUBLIC_CATALOG_ITEMS) {
    if (Array.isArray(raw) && raw.length > MAX_PUBLIC_CATALOG_ITEMS) {
      throw new Error('INVALID_CATALOG_SELECTION');
    }
    return new Map();
  }

  const result = new Map<string, number>();

  for (const entry of raw) {
    const id = String(entry?.id ?? '').trim().slice(0, 80);
    if (!id) continue;

    const quantity = Math.min(
      MAX_CATALOG_QUANTITY,
      Math.max(1, Math.floor(Number(entry?.quantity) || 1)),
    );
    result.set(id, Math.max(result.get(id) || 0, quantity));
  }

  return result;
}

export function catalogItemsForReservation(
  activeCatalog: BookingCatalogItem[],
  selectedAssets: Asset[],
  requested: Map<string, number>,
): BookingCatalogItem[] {
  const compatible = activeCatalog.filter(
    (item) => item._id && catalogItemAppliesToAnyAsset(item, selectedAssets),
  );
  const compatibleIds = new Set(
    compatible.map((item) => item._id).filter(Boolean) as string[],
  );

  for (const requestedId of requested.keys()) {
    if (!compatibleIds.has(requestedId)) {
      throw new Error('INVALID_CATALOG_SELECTION');
    }
  }

  return compatible.filter(
    (item) => item.required === true || (!!item._id && requested.has(item._id)),
  );
}

export function stockTrackedCatalogItemIds(items: BookingCatalogItem[]): string[] {
  return items
    .filter((item) => item.trackInventory === true && item._id)
    .map((item) => item._id as string);
}

export function resolveCatalogLines(
  selectedCatalogItems: BookingCatalogItem[],
  requested: Map<string, number>,
  start: Date,
  end: Date,
  fallbackCurrency: string,
  blockingItems: ReservationItem[] = [],
): ReservationCatalogLine[] {
  const billableDays = catalogBillableDays(start, end);

  return selectedCatalogItems.map((item) => {
    const id = item._id || '';
    const quantity = requested.get(id) || 1;

    if (item.trackInventory === true) {
      const reserved = id
        ? activeCatalogReservedQuantity(blockingItems, id)
        : 0;
      const available = availableCatalogStock(item.stockQuantity, reserved);

      if (quantity > available) {
        throw new Error('CATALOG_OUT_OF_STOCK');
      }
    }

    return catalogItemToReservationLine(
      item,
      quantity,
      billableDays,
      fallbackCurrency,
    );
  });
}

export function publicCatalogItem(
  item: BookingCatalogItem,
  fallbackCurrency: string,
  blockingItems: ReservationItem[] = [],
) {
  return {
    id: item._id || '',
    name: item.name || 'Extra',
    description: item.description || '',
    sku: item.sku || '',
    itemType: item.itemType || 'ADDON',
    priceCents: Math.max(0, Math.round(item.priceCents || 0)),
    currency: item.currency || fallbackCurrency,
    pricingMode: item.pricingMode || 'FIXED',
    taxable: item.taxable !== false,
    required: item.required === true,
    recommended: item.recommended === true,
    trackInventory: item.trackInventory === true,
    stockQuantity: item.trackInventory
      ? availableCatalogStock(
          item.stockQuantity,
          item._id
            ? activeCatalogReservedQuantity(blockingItems, item._id)
            : 0,
        )
      : null,
    compatibilityMode: item.compatibilityMode || 'ALL',
    applicableCategoryIdsJson: item.applicableCategoryIdsJson || '[]',
    applicableCategoriesJson: item.applicableCategoriesJson || '[]',
    applicableTagsJson: item.applicableTagsJson || '[]',
    applicableAssetIdsJson: item.applicableAssetIdsJson || '[]',
    excludedAssetIdsJson: item.excludedAssetIdsJson || '[]',
  };
}
