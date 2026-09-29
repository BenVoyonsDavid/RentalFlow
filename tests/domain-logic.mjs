import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const temp = await mkdtemp(join(tmpdir(), 'rentalflow-domain-'));
const root = resolve('.');

async function bundle(source, output) {
  const outfile = join(temp, output);
  await build({
    entryPoints: [source],
    absWorkingDir: root,
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
  });
  return import(pathToFileURL(outfile).href);
}

const finance = await bundle('src/lib/reservation-finance.ts', 'finance.mjs');
const pricing = await bundle('src/lib/rental-pricing.ts', 'pricing.mjs');
const availability = await bundle('src/lib/asset-availability.ts', 'asset-availability.mjs');
const catalog = await bundle('src/lib/reservation-catalog.ts', 'catalog.mjs');
const bookingCatalog = await bundle('src/lib/booking-catalog.ts', 'booking-catalog.mjs');
const inventory = await bundle('src/lib/catalog-inventory.ts', 'catalog-inventory.mjs');
const compatibility = await bundle('src/lib/catalog-compatibility.ts', 'compatibility.mjs');
const pagination = await bundle('src/lib/pagination.ts', 'pagination.mjs');
const references = await bundle('src/lib/reference-number.ts', 'reference-number.mjs');

// Taxes and deposits stay in integer cents.
assert.deepEqual(finance.calculateTaxes(10_000, {
  taxesEnabled: false,
  tax1Rate: 5,
  tax2Rate: 9.975,
}), {
  preTaxTotalCents: 10_000,
  tax1Cents: 0,
  tax2Cents: 0,
  taxTotalCents: 0,
  totalCents: 10_000,
});

assert.deepEqual(finance.calculateTaxes(10_000, {
  taxesEnabled: true,
  tax1Rate: 5,
  tax2Rate: 9.975,
  tax2Compound: false,
}), {
  preTaxTotalCents: 10_000,
  tax1Cents: 500,
  tax2Cents: 998,
  taxTotalCents: 1498,
  totalCents: 11_498,
});

assert.deepEqual(finance.calculateDeposit(20_000, 'DEPOSIT', 'PERCENT', 25), {
  depositAmountCents: 5_000,
  amountDueNowCents: 5_000,
  balanceDueCents: 15_000,
});
assert.equal(finance.calculateDeposit(20_000, 'DEPOSIT', 'FIXED', 250).amountDueNowCents, 20_000);
assert.equal(finance.calculateDeposit(20_000, 'FULL', 'PERCENT', 25).balanceDueCents, 0);
assert.equal(finance.calculateDeposit(20_000, 'NONE', 'PERCENT', 25).amountDueNowCents, 0);

// Rental pricing picks the cheapest configured package without under-billing duration.
const start = new Date('2026-10-01T09:00:00Z');
const eightDays = new Date('2026-10-09T09:00:00Z');
const price = pricing.calculateRentalPrice({
  dailyRateCents: 10_000,
  weeklyRateCents: 50_000,
  monthlyRateCents: 150_000,
}, start, eightDays, {
  allowWeekly: true,
  allowMonthly: true,
  allowLongTermDiscount: false,
});
assert.equal(price.billableDays, 8);
assert.equal(price.subtotalCents, 60_000);
assert.equal(price.totalCents, 60_000);

const discounted = pricing.calculateRentalPrice({
  dailyRateCents: 10_000,
  discountAfterDays: 7,
  discountPercent: 10,
}, start, eightDays, {
  allowWeekly: false,
  allowMonthly: false,
  allowLongTermDiscount: true,
});
assert.equal(discounted.subtotalCents, 80_000);
assert.equal(discounted.totalCents, 72_000);
assert.equal(discounted.discountPercent, 10);

assert.equal(
  pricing.rangesOverlap(
    new Date('2026-10-01T10:00:00Z'),
    new Date('2026-10-01T12:00:00Z'),
    new Date('2026-10-01T12:00:00Z'),
    new Date('2026-10-01T14:00:00Z'),
  ),
  false,
);
assert.equal(
  pricing.rangesOverlap(
    new Date('2026-10-01T10:00:00Z'),
    new Date('2026-10-01T12:00:00Z'),
    new Date('2026-10-01T11:59:00Z'),
    new Date('2026-10-01T14:00:00Z'),
  ),
  true,
);

// Asset availability ignores closed lines and respects buffers.
const availabilityStart = new Date('2026-10-10T12:00:00Z');
const availabilityEnd = new Date('2026-10-10T14:00:00Z');
assert.equal(availability.isAssetAvailable(
  'asset-1',
  availabilityStart,
  availabilityEnd,
  0,
  0,
  [{
    assetId: 'asset-1',
    blockedStartDateTime: new Date('2026-10-10T13:00:00Z'),
    blockedEndDateTime: new Date('2026-10-10T15:00:00Z'),
    status: 'CONFIRMED',
  }],
), false);
assert.equal(availability.isAssetAvailable(
  'asset-1',
  availabilityStart,
  availabilityEnd,
  0,
  0,
  [{
    assetId: 'asset-1',
    blockedStartDateTime: new Date('2026-10-10T13:00:00Z'),
    blockedEndDateTime: new Date('2026-10-10T15:00:00Z'),
    status: 'CANCELLED',
  }],
), true);
assert.equal(availability.isAssetAvailable(
  'asset-1',
  availabilityStart,
  availabilityEnd,
  1,
  0,
  [{
    assetId: 'asset-1',
    blockedStartDateTime: new Date('2026-10-10T10:30:00Z'),
    blockedEndDateTime: new Date('2026-10-10T11:30:00Z'),
    status: 'CONFIRMED',
  }],
), false);

// Human-facing reference numbers use date + 50 bits of secure entropy.
const deterministicReference = references.generateReferenceNumber(
  'RF',
  new Date('2026-09-29T12:00:00Z'),
  new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
);
assert.equal(deterministicReference, 'RF-20260929-ABCDEFGHJK');
assert.match(references.generateReferenceNumber('INS-D'), /^INS-D-\d{8}-[A-Z2-9]{10}$/);

const generatedReferences = new Set(
  Array.from({ length: 5000 }, () => references.generateReferenceNumber('PAY')),
);
assert.equal(generatedReferences.size, 5000);

// Pagination must not truncate availability checks at 1000 rows.
const pagedSource = Array.from({ length: 2505 }, (_, index) => ({ id: index + 1 }));
const pageOffsets = [];
const pagedItems = await pagination.collectAllPages(async (offset, limit) => {
  pageOffsets.push(offset);
  return pagedSource.slice(offset, offset + limit);
}, 1000);
assert.equal(pagedItems.length, 2505);
assert.deepEqual(pageOffsets, [0, 1000, 2000]);

// Inventory availability subtracts active overlapping reservation quantities.
const inventoryLines = [
  { catalogItemId: 'extra-1', reservationId: 'r1', quantity: 2, status: 'CONFIRMED' },
  { catalogItemId: 'extra-1', reservationId: 'r2', quantity: 3, status: 'RENTED' },
  { catalogItemId: 'extra-1', reservationId: 'r3', quantity: 4, status: 'CANCELLED' },
  { catalogItemId: 'extra-1', reservationId: 'r4', quantity: 5, status: 'COMPLETED' },
  { catalogItemId: 'other', reservationId: 'r5', quantity: 99, status: 'CONFIRMED' },
];
assert.equal(inventory.activeCatalogReservedQuantity(inventoryLines, 'extra-1'), 5);
assert.equal(inventory.activeCatalogReservedQuantity(inventoryLines, 'extra-1', 'r2'), 2);
assert.equal(inventory.availableCatalogStock(10, 5), 5);
assert.equal(inventory.availableCatalogStock(3, 5), 0);

// Booking catalog selection, compatibility and stock validation.
const parsedSelections = bookingCatalog.parseCatalogSelections([
  { id: ' extra-1 ', quantity: 2 },
  { id: 'extra-1', quantity: 5 },
  { id: 'extra-2', quantity: 5000 },
]);
assert.equal(parsedSelections.get('extra-1'), 5);
assert.equal(parsedSelections.get('extra-2'), 999);

const bookingAssets = [{
  _id: 'asset-1',
  productType: 'Roulotte',
  categoryId: 'cat-rv',
  categoryName: 'Roulottes',
  catalogTagsJson: '[]',
}];

const bookingCatalogItems = [
  {
    _id: 'required-extra',
    name: 'Obligatoire',
    itemType: 'ADDON',
    required: true,
    compatibilityMode: 'ALL',
    priceCents: 1000,
  },
  {
    _id: 'selected-extra',
    name: 'Sélectionné',
    itemType: 'ADDON',
    compatibilityMode: 'CATEGORIES',
    applicableCategoryIdsJson: '["cat-rv"]',
    priceCents: 2000,
    trackInventory: true,
    stockQuantity: 4,
  },
  {
    _id: 'wrong-category',
    name: 'Incompatible',
    itemType: 'ADDON',
    compatibilityMode: 'CATEGORIES',
    applicableCategoryIdsJson: '["cat-other"]',
    priceCents: 3000,
  },
];

const selectedBookingCatalog = bookingCatalog.catalogItemsForReservation(
  bookingCatalogItems,
  bookingAssets,
  new Map([['selected-extra', 2]]),
);
assert.deepEqual(
  selectedBookingCatalog.map((item) => item._id),
  ['required-extra', 'selected-extra'],
);
assert.deepEqual(
  bookingCatalog.stockTrackedCatalogItemIds(selectedBookingCatalog),
  ['selected-extra'],
);

assert.throws(
  () => bookingCatalog.catalogItemsForReservation(
    bookingCatalogItems,
    bookingAssets,
    new Map([['wrong-category', 1]]),
  ),
  /INVALID_CATALOG_SELECTION/,
);

const bookingLines = bookingCatalog.resolveCatalogLines(
  selectedBookingCatalog,
  new Map([['selected-extra', 2]]),
  new Date('2026-10-01T09:00:00Z'),
  new Date('2026-10-02T09:00:00Z'),
  'CAD',
  [{ catalogItemId: 'selected-extra', quantity: 1, status: 'CONFIRMED' }],
);
assert.equal(bookingLines.find((line) => line.catalogItemId === 'selected-extra')?.quantity, 2);

assert.throws(
  () => bookingCatalog.resolveCatalogLines(
    selectedBookingCatalog,
    new Map([['selected-extra', 4]]),
    new Date('2026-10-01T09:00:00Z'),
    new Date('2026-10-02T09:00:00Z'),
    'CAD',
    [{ catalogItemId: 'selected-extra', quantity: 1, status: 'CONFIRMED' }],
  ),
  /CATALOG_OUT_OF_STOCK/,
);

const publicExtra = bookingCatalog.publicCatalogItem(
  bookingCatalogItems[1],
  'CAD',
  [{ catalogItemId: 'selected-extra', quantity: 3, status: 'CONFIRMED' }],
);
assert.equal(publicExtra.stockQuantity, 1);
assert.equal(publicExtra.applicableCategoryIdsJson, '["cat-rv"]');

// Catalog pricing and compatibility.
const perDayItem = {
  _id: 'extra-1',
  name: 'Extra',
  pricingMode: 'PER_DAY',
  priceCents: 2_000,
  taxable: true,
};
assert.equal(catalog.catalogLineTotalCents(perDayItem, 2, 3), 12_000);

const asset = {
  _id: 'asset-1',
  productType: 'Roulotte',
  categoryId: 'cat-rv',
  categoryName: 'Roulottes',
  catalogTagsJson: JSON.stringify(['camping', 'livrable']),
};
assert.equal(compatibility.catalogItemAppliesToAsset({
  compatibilityMode: 'CATEGORIES',
  applicableCategoryIdsJson: JSON.stringify(['cat-rv']),
}, asset), true);
assert.equal(compatibility.catalogItemAppliesToAsset({
  compatibilityMode: 'TAGS',
  applicableTagsJson: JSON.stringify(['camping']),
}, asset), true);
assert.equal(compatibility.catalogItemAppliesToAsset({
  compatibilityMode: 'ALL',
  excludedAssetIdsJson: JSON.stringify(['asset-1']),
}, asset), false);

console.log('PASS: RentalFlow domain pricing, availability, finance, references, pagination, inventory and booking catalog rules.');
