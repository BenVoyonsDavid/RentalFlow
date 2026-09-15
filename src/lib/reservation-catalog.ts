import { calculateTaxes } from './reservation-finance';

export type ReservationLineType = 'RENTAL' | 'PRODUCT' | 'ADDON' | 'SERVICE';
export type CatalogItemType = Exclude<ReservationLineType, 'RENTAL'>;
export type CatalogPricingMode = 'FIXED' | 'PER_UNIT' | 'PER_DAY' | 'PER_RESERVATION';

export type CatalogReservationItem = {
  _id?: string;
  name?: string;
  description?: string;
  sku?: string;
  itemType?: CatalogItemType;
  priceCents?: number;
  currency?: string;
  pricingMode?: CatalogPricingMode;
  taxable?: boolean;
  active?: boolean;
  required?: boolean;
  recommended?: boolean;
  trackInventory?: boolean;
  stockQuantity?: number;
};

export type ReservationCatalogLine = {
  _id?: string;
  lineType?: ReservationLineType;
  catalogItemId?: string;
  catalogItemType?: CatalogItemType;
  itemName?: string;
  sku?: string;
  quantity?: number;
  unitPriceCents?: number;
  taxable?: boolean;
  billableDays?: number;
  pricingMode?: string;
  lineTotalCents?: number;
  currency?: string;
};

export type ReservationRentalLine = ReservationCatalogLine & {
  assetId?: string;
};

export type ReservationTaxSettings = {
  taxesEnabled?: boolean;
  tax1Name?: string;
  tax1Rate?: number;
  tax2Name?: string;
  tax2Rate?: number;
  tax2Compound?: boolean;
};

export function reservationLineType(line: ReservationCatalogLine): ReservationLineType {
  return line.lineType === 'PRODUCT' || line.lineType === 'ADDON' || line.lineType === 'SERVICE'
    ? line.lineType
    : 'RENTAL';
}

export function catalogBillableDays(start?: Date | string, end?: Date | string): number {
  if (!start || !end) return 1;
  const from = start instanceof Date ? start : new Date(start);
  const to = end instanceof Date ? end : new Date(end);
  const duration = to.getTime() - from.getTime();
  if (!Number.isFinite(duration) || duration <= 0) return 1;
  return Math.max(1, Math.ceil(duration / 86_400_000));
}

export function normalizeCatalogQuantity(item: CatalogReservationItem, quantity: number): number {
  const normalized = Math.max(1, Math.floor(Number.isFinite(quantity) ? quantity : 1));
  if (item.pricingMode === 'FIXED' || item.pricingMode === 'PER_RESERVATION') return 1;
  return normalized;
}

export function catalogLineTotalCents(
  item: CatalogReservationItem,
  requestedQuantity: number,
  billableDays: number,
): number {
  const unitPrice = Math.max(0, Math.round(item.priceCents || 0));
  const quantity = normalizeCatalogQuantity(item, requestedQuantity);
  if (item.pricingMode === 'PER_DAY') return unitPrice * quantity * Math.max(1, Math.floor(billableDays || 1));
  if (item.pricingMode === 'PER_UNIT') return unitPrice * quantity;
  return unitPrice;
}

export function catalogItemToReservationLine(
  item: CatalogReservationItem,
  requestedQuantity: number,
  billableDays: number,
  fallbackCurrency = 'CAD',
): ReservationCatalogLine {
  if (!item._id) throw new Error('CATALOG_ITEM_ID_REQUIRED');
  const quantity = normalizeCatalogQuantity(item, requestedQuantity);
  const days = Math.max(1, Math.floor(billableDays || 1));
  return {
    lineType: item.itemType || 'ADDON',
    catalogItemId: item._id,
    catalogItemType: item.itemType || 'ADDON',
    itemName: item.name || 'Article catalogue',
    sku: item.sku || '',
    quantity,
    unitPriceCents: Math.max(0, Math.round(item.priceCents || 0)),
    taxable: item.taxable !== false,
    billableDays: item.pricingMode === 'PER_DAY' ? days : 0,
    pricingMode: item.pricingMode || 'FIXED',
    lineTotalCents: catalogLineTotalCents(item, quantity, days),
    currency: item.currency || fallbackCurrency,
  };
}

export function computeReservationFinancials(
  lines: ReservationCatalogLine[],
  customerDiscountPercent: number,
  settings: ReservationTaxSettings,
) {
  const activeLines = lines.filter((line) => reservationLineType(line) !== 'RENTAL' || (line.lineTotalCents || 0) >= 0);
  const subtotalCents = activeLines.reduce((sum, line) => sum + Math.max(0, Math.round(line.lineTotalCents || 0)), 0);

  const discountPercent = Math.min(100, Math.max(0, Number(customerDiscountPercent) || 0));
  const taxableSubtotalCents = activeLines.reduce((sum, line) => {
    const taxable = reservationLineType(line) === 'RENTAL' || line.taxable !== false;
    return taxable ? sum + Math.max(0, Math.round(line.lineTotalCents || 0)) : sum;
  }, 0);
  const nonTaxableSubtotalCents = Math.max(0, subtotalCents - taxableSubtotalCents);

  const taxableAfterDiscountCents = Math.max(0, Math.round(taxableSubtotalCents * (1 - discountPercent / 100)));
  const nonTaxableAfterDiscountCents = Math.max(0, Math.round(nonTaxableSubtotalCents * (1 - discountPercent / 100)));
  const preTaxTotalCents = taxableAfterDiscountCents + nonTaxableAfterDiscountCents;
  const discountCents = Math.max(0, subtotalCents - preTaxTotalCents);

  const taxes = calculateTaxes(taxableAfterDiscountCents, settings);
  const tax1Cents = taxes.tax1Cents;
  const tax2Cents = taxes.tax2Cents;
  const taxTotalCents = taxes.taxTotalCents;
  const totalCents = preTaxTotalCents + taxTotalCents;

  return {
    subtotalCents,
    discountCents,
    preTaxTotalCents,
    tax1Cents,
    tax2Cents,
    taxTotalCents,
    totalCents,
    taxableSubtotalCents,
    nonTaxableSubtotalCents,
  };
}
