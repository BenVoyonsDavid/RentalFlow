import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'rentalflow-phase5-'));
const outfile = join(dir, 'payment.mjs');
await build({ entryPoints: ['src/lib/payment-reconciliation.ts'], bundle: true, platform: 'node', format: 'esm', outfile });
const { reservationBalanceCents, reservationBalanceNeedsSync, reservationStageAfterBalance, verifiedWixPaymentLink } =
  await import(pathToFileURL(outfile).href);

const CAD = 'CAD';
const pay = (paymentType, amountCents, status = 'PAID', currency = CAD) =>
  ({ paymentType, amountCents, status, currency });

const settled = [
  pay('PAYMENT', 6000),
  pay('BOOKING_DEPOSIT', 2000),
  pay('REFUND', 1500),
  pay('SECURITY_DEPOSIT', 4000),
  pay('DAMAGE_CHARGE', 3000),
  pay('DEPOSIT_REFUND', 1000),
  pay('PAYMENT', 4000, 'PENDING'),
  pay('PAYMENT', 2500, 'PAID', 'USD'),
];
assert.equal(reservationBalanceCents(10000, settled, CAD), 3500,
  'Only settled rental payments net of rental refunds count toward CAD balance');
assert.equal(reservationBalanceCents(10000, [pay('PAYMENT', 10000)], CAD), 0);
assert.equal(reservationBalanceCents(10000, [pay('PAYMENT', 10000), pay('REFUND', 1000)], CAD), 1000);
assert.equal(reservationBalanceCents(10000, [pay('PAYMENT', 15000)], CAD), 0);
assert.equal(reservationBalanceCents(10000, [pay('PAYMENT', -500)], CAD), 10000);

assert.equal(reservationStageAfterBalance('PAYMENT', 0), 'READY');
assert.equal(reservationStageAfterBalance('READY', 250), 'PAYMENT');
assert.equal(reservationStageAfterBalance('COMPLETED', 250), 'COMPLETED');
assert.equal(reservationStageAfterBalance('RENTED', 250), 'RENTED');
assert.equal(reservationBalanceNeedsSync({ balanceDueCents: 0, workflowStage: 'PAYMENT' }, 0), true);
assert.equal(reservationBalanceNeedsSync({ balanceDueCents: 1000, workflowStage: 'READY' }, 1000), true);
assert.equal(reservationBalanceNeedsSync({ balanceDueCents: 1000, workflowStage: 'PAYMENT' }, 1000), false);
assert.equal(reservationBalanceNeedsSync({ balanceDueCents: undefined, workflowStage: 'PAYMENT' }, 1000), true);

const payment = { wixPaymentLinkId: 'verified-link', amountCents: 12500, currency: CAD };
function wixLink(status, amount, overrides = {}) {
  return { paymentLink: {
    id: 'verified-link', currency: CAD, status,
    totalReceived: { amount, paymentCount: status === 'PAID' ? 1 : 0 },
    ...overrides,
  } };
}
assert.equal(verifiedWixPaymentLink(wixLink('PAID', '125'), payment)?.amountCents, 12500);
assert.equal(verifiedWixPaymentLink(wixLink('PAID', '120'), payment), null);
assert.equal(verifiedWixPaymentLink(wixLink('PAID', undefined), payment), null);
assert.equal(verifiedWixPaymentLink(wixLink('PAID', '125', { currency: 'USD' }), payment), null);
assert.equal(verifiedWixPaymentLink(wixLink('PAID', '125', { id: 'different' }), payment), null);
assert.equal(verifiedWixPaymentLink(wixLink('ACTIVE', '125'), payment), null);
assert.equal(verifiedWixPaymentLink(wixLink('PAID', '125', { id: '' }), payment), null);
assert.equal(verifiedWixPaymentLink(wixLink('PAID', '125', { currency: '' }), payment), null);

const route = await readFile('src/pages/api/reconcile-payments.ts', 'utf8');
const dashboard = await readFile('src/extensions/dashboard/pages/reservations/reservations-v2.tsx', 'utf8');
const paymentsCollection = await readFile('src/extensions/backend/data-collections/payments.ts', 'utf8');
const types = await readFile('src/domain/types.ts', 'utf8');
const start = dashboard.indexOf('  const refreshWixPayment = async');
const end = dashboard.indexOf('  const saveNotes =', start);
const refresh = dashboard.slice(start, end);
assert(start >= 0 && end > start);
assert(refresh.includes('httpClient.fetchWithAuth('));
assert(refresh.includes('/api/reconcile-payments'));
assert(refresh.includes('if (!response.ok)'));
assert(!refresh.includes('items.update('), 'UI must not mark a Wix payment paid directly');
assert(!refresh.includes('getPaymentLink('), 'Wix verification must be server-side');
assert(route.includes('verifiedWixPaymentLink(response, payment)'));
assert(route.includes(".eq('status', 'PAID')"), 'A later refresh must find previously confirmed receipts');
assert(route.includes('const byReservation = new Map'), 'Repair should deduplicate reservation updates');
assert(route.includes('consistentRead: true'), 'Read back freshly confirmed receipt consistently');
assert(route.includes("reservationBalanceNeedsSync("));
assert(route.includes('payment.remainingBalanceCents === balanceDueCents'));
assert(!route.includes(".eq('balanceSyncPending'"), 'Reconciliation must not query an absent CMS field');
assert(!route.includes('balanceSyncPending:'), 'Reconciliation must not write an absent CMS field');
assert(!paymentsCollection.includes("key: 'balanceSyncPending'"), 'Use the installed CMS schema');
assert(!types.includes('balanceSyncPending?: boolean'));
assert(dashboard.includes('if (pendingOnlinePayment) return setError('));
assert(dashboard.includes('safeBookingCheckoutUrl(payment.wixPaymentUrl)'));
assert(dashboard.includes('safeBookingCheckoutUrl(checkoutUrl)'));

assert(dashboard.includes("selectedReservation.status === 'COMPLETED' && liveBalance > 0"));
assert(dashboard.includes('reservationBalanceCents(selectedReservation.totalCents'));
console.log('PASS: phase 5 server-only Wix confirmation, refunds, no new CMS field, no duplicate pending link, and resumable balance updates.');
