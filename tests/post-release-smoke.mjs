import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

/**
 * Post-release regression simulation. All inputs are synthetic.
 * No Wix mutation, plan upgrade, external checkout, or webhook is performed.
 */
const dir = await mkdtemp(join(tmpdir(), 'rentalflow-post-release-'));
const mockSdk = {
  name: 'safe-wix-runtime-mocks',
  setup(builder) {
    builder.onResolve({ filter: /^@wix\/app-management$/ }, () => ({ path: 'app', namespace: 'mock-wix' }));
    builder.onResolve({ filter: /^@wix\/essentials$/ }, () => ({ path: 'essential', namespace: 'mock-wix' }));
    builder.onLoad({ filter: /^app$/, namespace: 'mock-wix' }, () => ({
      loader: 'js',
      contents: `export const appInstances = {
        onAppInstanceInstalled: callback => callback,
        onAppInstancePaidPlanChanged: callback => callback,
        onAppInstanceRemoved: callback => callback,
        getAppInstance: async () => { throw new Error('NO_AUTHORIZED_INSTANCE'); }
      };`,
    }));
    builder.onLoad({ filter: /^essential$/, namespace: 'mock-wix' }, () => ({
      loader: 'js',
      contents: 'export const httpClient = { fetchWithAuth: (...args) => globalThis.__rentalFlowTestFetchWithAuth(...args) };',
    }));
  },
};

async function bundleAndLoad(entryPoint, label) {
  const outfile = join(dir, `${label}.mjs`);
  await build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    plugins: [mockSdk],
  });
  return import(pathToFileURL(outfile).href);
}

// 1. Financial reconciliation: zero received ≠ zero due, even if an unpaid
// payment's remainingBalanceCents is a projected value of zero.
const pay = await bundleAndLoad('src/lib/payment-reconciliation.ts', 'payment');
const pending = {
  status: 'PENDING', paymentType: 'PAYMENT',
  currency: 'CAD', amountCents: 14400, remainingBalanceCents: 0,
};
const expected = {
  wixPaymentLinkId: 'integration-test-link',
  currency: 'CAD',
  amountCents: 14400,
};
const wixLink = (status, amount, overrides = {}) => ({
  paymentLink: {
    id: 'integration-test-link', currency: 'CAD', status,
    totalReceived: { amount, paymentCount: amount === '0' ? 0 : 1 },
    ...overrides,
  },
});
assert.equal(pay.wixReceivedAmountCents('0'), 0);
assert.equal(pay.verifiedWixPaymentLink(wixLink('ACTIVE', '0'), expected), null,
  'A link open with zero actual receipts must remain unpaid');
assert.equal(pay.reservationBalanceCents(14400, [pending], 'CAD'), 14400,
  'A projected post-checkout balance of zero must not credit an unpaid rental');
assert.equal(pay.reservationStageAfterBalance('PAYMENT', 14400), 'PAYMENT');
assert.equal(pay.verifiedWixPaymentLink(wixLink('PAID', '144'), expected)?.amountCents, 14400);
assert.equal(pay.verifiedWixPaymentLink(wixLink('PAID', '144', { currency: 'USD' }), expected), null);
assert.equal(pay.verifiedWixPaymentLink(wixLink('PAID', '144', { id: 'other' }), expected), null);
assert.equal(pay.verifiedWixPaymentLink(wixLink('PAID', '0'), expected), null);
assert.equal(pay.verifiedWixPaymentLink(wixLink('PAID', '143.99'), expected), null);
assert.equal(pay.reservationBalanceCents(14400, [{ ...pending, status: 'PAID' }], 'CAD'), 0);
assert.equal(pay.reservationBalanceCents(14400, [{ ...pending, status: 'PAID', currency: 'USD' }], 'CAD'), 14400);

const dashboard = await readFile('src/extensions/dashboard/pages/reservations/reservations-v2.tsx', 'utf8');
assert(dashboard.includes('remainingBalanceCents: Math.max(0, liveBalance - amount)'),
  'An unpaid Wix link stores a projected post-payment balance');
assert(dashboard.includes('reservationBalanceCents(selectedReservation.totalCents || 0, linkedPayments,'),
  'UI must compute the current balance from actual receipt status');
assert(dashboard.includes("selectedReservation.status === 'COMPLETED' && liveBalance > 0"),
  'Closed but unpaid reservations must expose a warning');
console.log('PASS 1: Zero actual payment remains PENDING; CAD, identity and amount checks protect balances.');

// 2. Plan feature rights: simulate all three real Wix plan names plus the
// free tier, trial and an unknown paid package. No purchases or account edits.
const plans = await bundleAndLoad('src/lib/plans.ts', 'plans');
const cases = [
  ['RentalFlow Starter', 'STARTER', 25, false, false],
  ['RentalFlow Business', 'BUSINESS', 100, true, false],
  ['RentalFlow Pro', 'PRO', null, true, true],
];
for (const [packageName, planName, assetLimit, inspections, unlimited] of cases) {
  const plan = plans.planFromAppInstanceResponse({
    instance: { isFree: false, billing: { packageName } },
    site: { url: 'https://rental-company.example/' },
  });
  assert.equal(plan, planName);
  assert.equal(plans.assetLimitForPlan(plan), assetLimit);
  assert.equal(plans.hasFeature(plan, 'INSPECTIONS'), inspections);
  assert.equal(plans.hasFeature(plan, 'UNLIMITED_ASSETS'), unlimited);
  assert.equal(plans.hasFeature(plan, 'PAYMENTS'), true);
}
assert.equal(plans.planFromAppInstanceResponse({
  instance: { isFree: true },
  site: { url: 'https://rental-company.example/' },
}), 'BASIC');
assert.equal(plans.planFromAppInstanceResponse({
  instance: { isFree: true },
  site: { url: 'https://example.wix-development-sites.org/' },
}), 'TRIAL');
assert.equal(plans.planFromPackageName('unrecognized', true), 'BASIC');
assert.equal(plans.planFromPackageName('unrecognized', false), 'STARTER');
assert.equal(plans.planFromPackageName('unrecognized', undefined), 'NO_PLAN');
assert.equal(plans.hasFeature('NO_PLAN', 'PAYMENTS'), false);
assert.equal(plans.canCreateAsset('STARTER', 25), false);
assert.equal(plans.canCreateAsset('BUSINESS', 99), true);
assert.equal(plans.canCreateAsset('BUSINESS', 100), false);
assert.equal(plans.canCreateAsset('PRO', 1000000), true);
console.log('PASS 2: Starter, Business and Pro rights and limits, no-plan fail-closed, safe development trial.');

// 3. BI: prove the actual client sends authenticated calls to the correct
// server route, handles HTTP errors, and validates events. No remote telemetry.
const bi = await bundleAndLoad('src/lib/bi-events.ts', 'bi');
const client = await bundleAndLoad('src/lib/bi-events-client.ts', 'bi-client');
assert.equal(bi.normalizeBiEventInput({ eventName: 'APP_DASHBOARD_LOADED' })?.eventName, 'APP_DASHBOARD_LOADED');
assert.equal(bi.normalizeBiEventInput({ eventName: 'CUSTOM', customEventName: 'rentalflow_reservation_created' })?.customEventName, 'rentalflow_reservation_created');
assert.equal(bi.normalizeBiEventInput({ eventName: 'CUSTOM', customEventName: 'unapproved_test_event' }), null);
let calls = [];
globalThis.__rentalFlowTestFetchWithAuth = async (url, options) => {
  calls.push({ url, options });
  return { ok: true, status: 200 };
};
assert.equal(await client.sendRentalFlowBiEvent({ eventName: 'APP_DASHBOARD_LOADED' }, 'https://app.example/'), true);
assert.equal(calls.length, 1);
assert.equal(calls[0].url, 'https://app.example/api/bi-event');
assert.equal(calls[0].options.method, 'POST');
assert.deepEqual(JSON.parse(calls[0].options.body), { eventName: 'APP_DASHBOARD_LOADED' });
globalThis.__rentalFlowTestFetchWithAuth = async () => ({ ok: false, status: 403, text: async () => '' });
const oldWarn = console.warn;
console.warn = () => {};
try {
  assert.equal(await client.sendRentalFlowBiEvent({ eventName: 'APP_DASHBOARD_LOADED' }, 'https://app.example'), false);
} finally {
  console.warn = oldWarn;
}
delete globalThis.__rentalFlowTestFetchWithAuth;

const originalFetch = globalThis.fetch;
try {
  const wire = [];
  globalThis.fetch = async (url, opts) => {
    wire.push({ url, opts });
    return { ok: true, status: 200 };
  };
  await bi.sendBiEventToWix('synthetic-local-token', { eventName: 'APP_DASHBOARD_LOADED' });
  assert.equal(wire.length, 1);
  assert.equal(wire[0].url, 'https://www.wixapis.com/apps/v1/bi-event');
  assert.deepEqual(JSON.parse(wire[0].opts.body), { eventName: 'APP_DASHBOARD_LOADED' });
} finally {
  globalThis.fetch = originalFetch;
}
console.log('PASS 3a: BI event serialization, authorized client route, Wix forwarding and graceful 403 handling.');

// 4. Wix lifecycle handler behavior using a controlled SDK stub; neither
// install, plan upgrade nor uninstall is triggered on a real site.
const lifecycle = [
  ['app-installed', 'installed'],
  ['app-plan-changed', 'plan-changed'],
  ['app-removed', 'removed'],
];
for (const [slug, eventName] of lifecycle) {
  const { default: handler } = await bundleAndLoad(
    `src/extensions/backend/events/${slug}/${slug}.ts`,
    slug,
  );
  assert.equal(typeof handler, 'function');
  const logs = [];
  const originalInfo = console.info;
  console.info = (...args) => logs.push(args.map(String).join(' '));
  try {
    await handler({ instanceId: 'not-to-be-logged', ownerEmail: 'private@example.invalid' });
    await handler({ instanceId: 'duplicate-test', ownerEmail: 'other@example.invalid' });
  } finally {
    console.info = originalInfo;
  }
  assert.deepEqual(logs, [
    `RentalFlow app lifecycle: ${eventName}`,
    `RentalFlow app lifecycle: ${eventName}`,
  ]);
  assert(!logs.join(' ').includes('private@example.invalid'));
  assert(!logs.join(' ').includes('duplicate-test'));
}
console.log('PASS 3b: Install, upgrade/downgrade and uninstall handler callbacks log only event type, with no data mutations.');
console.log('All post-release local simulations passed. External Wix billing, delivery and checkout remain unproven.');
