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
const catalog = await bundle('src/lib/reservation-catalog.ts', 'catalog.mjs');
const compatibility = await bundle('src/lib/catalog-compatibility.ts', 'compatibility.mjs');

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

console.log('PASS: RentalFlow domain pricing, finance and catalog rules.');
