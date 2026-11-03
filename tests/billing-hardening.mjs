import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = resolve('.');
const dir = await mkdtemp(join(tmpdir(), 'rentalflow-billing-'));
async function bundle(path, name) {
  const outfile = join(dir, name);
  await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'node', outfile });
  return import(pathToFileURL(outfile).href);
}
const { wixReceivedAmountCents, verifiedWixPaymentLink, reservationBalanceCents } =
  await bundle('src/lib/payment-reconciliation.ts', 'reconcile.mjs');
const plans = await bundle('src/lib/plans.ts', 'plans.mjs');

for (const [value, cents] of [
  [25.01, 2501], ['25.01', 2501], ['1,23', 123], ['0.05', 5],
  ['0', 0], ['-1', null], ['1e3', null], ['2.001', null],
  [null, null], [{ amount: '2' }, null], ['', null],
  ['9007199254740990000000', null],
]) assert.equal(wixReceivedAmountCents(value), cents, String(value));

const payment = { wixPaymentLinkId: 'link-123', amountCents: 2500, currency: 'CAD' };
function link(status, amount, overrides = {}) {
  return { paymentLink: {
    _id: 'link-123', currency: 'CAD', status,
    totalReceived: { paymentCount: status === 'PAID' ? 1 : 0, amount },
    transactionId: 'tx-456', lastPaymentDate: '2030-01-01T13:00:00Z',
    ...overrides,
  } };
}
const paid = verifiedWixPaymentLink(link('PAID', '25.00'), payment);
assert.equal(paid?.amountCents, 2500);
assert.equal(paid?.transactionId, 'tx-456');
assert.equal(paid?.paymentDate?.toISOString(), '2030-01-01T13:00:00.000Z');
assert.equal(verifiedWixPaymentLink(link('ACTIVE', '25.00'), payment), null);
assert.equal(verifiedWixPaymentLink(link('PAID', '10.00'), payment), null);
assert.equal(verifiedWixPaymentLink(link('PAID', '0'), payment), null);
assert.equal(verifiedWixPaymentLink(link('PAID', undefined), payment), null);
assert.equal(verifiedWixPaymentLink(link('PAID', '25.00', { currency: 'USD' }), payment), null);
assert.equal(verifiedWixPaymentLink(link('PAID', '25.00', { _id: 'wrong-id' }), payment), null);
assert.equal(verifiedWixPaymentLink(link('ACTIVE', '25.00', { totalReceived: { paymentCount: 1, amount: '25.00' } }), payment)?.amountCents, 2500);
assert.equal(verifiedWixPaymentLink(link('PAID', '100.00'), payment)?.amountCents, 2500);
assert.equal(verifiedWixPaymentLink(link('PAID', '25.00'), { ...payment, amountCents: 0 }), null);

const payments = [
  { paymentType: 'PAYMENT', status: 'PAID', currency: 'CAD', amountCents: 3000 },
  { paymentType: 'BOOKING_DEPOSIT', status: 'PAID', currency: 'CAD', amountCents: 2000 },
  { paymentType: 'SECURITY_DEPOSIT', status: 'PAID', currency: 'CAD', amountCents: 8000 },
  { paymentType: 'DAMAGE_CHARGE', status: 'PAID', currency: 'CAD', amountCents: 5000 },
  { paymentType: 'DEPOSIT_REFUND', status: 'PAID', currency: 'CAD', amountCents: 1500 },
  { paymentType: 'PAYMENT', status: 'PENDING', currency: 'CAD', amountCents: 5000 },
  { paymentType: 'PAYMENT', status: 'PAID', currency: 'USD', amountCents: 3000 },
  { paymentType: 'REFUND', status: 'PAID', currency: 'CAD', amountCents: 1000 },
];
assert.equal(reservationBalanceCents(10000, payments, 'CAD'), 6000);
assert.equal(reservationBalanceCents(10000, payments.filter(p => p.paymentType !== 'REFUND'), 'CAD'), 5000);
assert.equal(reservationBalanceCents(10000, [{ paymentType: 'PAYMENT', status: 'PAID', currency: 'CAD', amountCents: 15000 }], 'CAD'), 0);
assert.equal(reservationBalanceCents(10000, [{ paymentType: 'PAYMENT', status: 'PAID', currency: 'USD', amountCents: 15000 }], 'CAD'), 10000);
assert.equal(reservationBalanceCents(10000, [{ paymentType: 'PAYMENT', status: 'PAID', currency: 'CAD', amountCents: -500 }], 'CAD'), 10000);

assert.equal(plans.planFromPackageName('Basic', true), 'BASIC');
assert.equal(plans.planFromPackageName('RentalFlow Starter Annual', false), 'STARTER');
assert.equal(plans.planFromPackageName('RentalFlow Business', false), 'BUSINESS');
assert.equal(plans.planFromPackageName('Pro', false), 'PRO');
assert.equal(plans.planFromPackageName('Premium', false), 'PRO');
assert.equal(plans.planFromPackageName('Proxy', false), 'STARTER');
assert.equal(plans.planFromPackageName('Professional', false), 'STARTER');
assert.equal(plans.planFromPackageName('MyBusinessTools', false), 'STARTER');
assert.equal(plans.planFromPackageName('Starter Trial Basic', true), 'BASIC');
assert.equal(plans.planFromPackageName('Unknown', undefined), 'NO_PLAN');
assert.equal(plans.assetLimitForPlan('BASIC'), 5);
assert.equal(plans.assetLimitForPlan('STARTER'), 25);
assert.equal(plans.assetLimitForPlan('BUSINESS'), 100);
assert.equal(plans.assetLimitForPlan('PRO'), null);
assert.equal(plans.hasFeature('BASIC', 'PAYMENTS'), false);
assert.equal(plans.hasFeature('STARTER', 'PAYMENTS'), true);
assert.equal(plans.hasFeature('STARTER', 'INSPECTIONS'), false);
assert.equal(plans.hasFeature('BUSINESS', 'INSPECTIONS'), true);

const reconcile = await readFile(join(root, 'src/pages/api/reconcile-payments.ts'), 'utf8');
const creation = await readFile(join(root, 'src/server/payment-service.ts'), 'utf8');
assert(reconcile.includes('verifiedWixPaymentLink(response, payment)'));
assert(reconcile.includes('reservationBalanceCents('));
assert(creation.includes('safeBookingCheckoutUrl(checkoutUrl)'));
assert(creation.includes("throw new Error('PAYLINK_NO_SECURE_URL')"));
assert(reconcile.includes('requireDashboardUser()'));
console.log('PASS: Wix payment amount/currency/identity checks, financial accounting and plan limits.');
