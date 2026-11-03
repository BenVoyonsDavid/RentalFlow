import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const root = resolve('.');
const tmp = await mkdtemp(join(tmpdir(), 'rentalflow-journey-'));
await build({ entryPoints: ['src/lib/booking-checkout.ts'], bundle: true, format: 'esm', platform: 'node', outfile: join(tmp, 'checkout.mjs') });
const { safeBookingCheckoutUrl } = await import(pathToFileURL(join(tmp, 'checkout.mjs')).href);
assert.equal(safeBookingCheckoutUrl('https://checkout.wix.com/rental/1'), 'https://checkout.wix.com/rental/1');
for (const unsafe of ['javascript:alert(1)', 'data:text/html,hi', 'http://wix.test/pay', 'https://user:secret@wix.test/pay', '//wix.test/pay', '', null]) {
  assert.equal(safeBookingCheckoutUrl(unsafe), '', String(unsafe));
}
const mock = "export const httpClient={fetchWithAuth:(...args)=>fetch(...args)};export const i18n={getLanguage:()=>window.testLanguage||'fr',getLocale:()=>window.testLanguage==='en'?'en-CA':'fr-CA'};";
const plugins = [{
  name: 'test-wix',
  setup(b) {
    b.onResolve({ filter: /^@wix\/essentials$/ }, () => ({ path: 'wix', namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: mock, loader: 'js' }));
    b.onResolve({ filter: /\.css\?inline$/ }, args => ({ path: resolve(args.resolveDir, args.path.slice(0, -7)), namespace: 'inline' }));
    b.onLoad({ filter: /.*/, namespace: 'inline' }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'text' }));
  },
}];
await build({
  stdin: {
    contents: "import Widget from './src/extensions/site/widgets/rental-flow-online-booking/rental-flow-online-booking.navigation.runtime';customElements.define('test-booking-journey',Widget);",
    resolveDir: root,
  },
  bundle: true, format: 'esm', outfile: join(tmp, 'widget.js'), plugins,
  define: { 'import.meta.env.BASE_API_URL': '""' },
});
const baseSettings = {
  currency: 'CAD', taxesEnabled: true, tax1Name: 'TPS', tax1Rate: 5,
  tax2Name: 'TVQ', tax2Rate: 9.975, tax2Compound: false,
  paymentsEnabled: true, depositEnabled: true, depositType: 'PERCENT',
  depositValue: 25, requiredFields: [],
};
const assets = [{
  id: 'a1', title: 'Caméra de location', productType: 'Vidéo',
  categoryId: 'camera', categoryName: 'Caméras',
  dailyRateCents: 10000, lineTotalCents: 20000,
  billableDays: 2, pricingMode: 'DAILY', currency: 'CAD',
}];
const catalogItems = [{
  id: 'required', name: 'Protection', itemType: 'ADDON', required: true,
  priceCents: 2000, pricingMode: 'FIXED', currency: 'CAD', taxable: true,
  compatibilityMode: 'ALL',
}];
let mode = 'paid';
let delayMs = 0;
let postCount = 0;
const submissions = [];
const server = createServer(async (req, res) => {
  const path = new URL(req.url || '/', 'http://localhost');
  res.setHeader('Content-Type', 'application/json');
  if (path.pathname === '/widget.js') {
    res.setHeader('Content-Type', 'text/javascript');
    res.end(await readFile(join(tmp, 'widget.js')));
    return;
  }
  if (path.pathname === '/api/bi-event') { res.end('{}'); return; }
  if (path.pathname === '/api/public-booking') {
    if (req.method === 'POST') {
      let raw = '';
      for await (const part of req) raw += part;
      submissions.push(JSON.parse(raw));
      postCount++;
      if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
      if (mode === 'payment-error') {
        res.statusCode = 502;
        res.end(JSON.stringify({ error: 'Le paiement Wix n’a pas pu être préparé.' }));
        return;
      }
      if (mode === 'conflict') {
        res.statusCode = 409;
        res.end(JSON.stringify({ error: 'Cet équipement n’est plus disponible pour cette période.' }));
        return;
      }
      const unpaid = mode === 'offline';
      const checkoutUrl = unpaid ? '' : mode === 'unsafe-checkout'
        ? 'javascript:alert(1)' : 'https://checkout.wix.com/rental/demo';
      res.end(JSON.stringify({
        reservationNumber: 'RF-TEST-' + postCount,
        totalCents: 25300,
        amountDueNowCents: unpaid ? 0 : 25300,
        balanceDueCents: unpaid ? 25300 : 0,
        currency: 'CAD', checkoutUrl,
      }));
      return;
    }
    const hasPeriod = Boolean(path.searchParams.get('start') && path.searchParams.get('end'));
    if (mode === 'availability-error' && hasPeriod) {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'Availability unavailable' }));
      return;
    }
    res.end(JSON.stringify({
      company: { name: 'RentalFlow test', logoUrl: '' },
      settings: { ...baseSettings, paymentsEnabled: mode !== 'offline' },
      assets: assets.map(asset => ({ ...asset, available: hasPeriod ? true : null })),
      catalogItems,
    }));
    return;
  }
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><html><body><test-booking-journey></test-booking-journey><script type="module" src="/widget.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const siteUrl = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const start = '2030-05-20T09:00';
const end = '2030-05-22T17:00';

async function enterBooking() {
  await page.goto(siteUrl);
  await page.locator('#search').waitFor();
  await page.locator('#start').fill(start);
  await page.locator('#end').fill(end);
  await page.locator('#search').click();
  await page.locator('[data-asset="a1"]:enabled').waitFor();
  await page.locator('[data-asset="a1"]').click();
  await page.locator('[name="customerName"]').fill('Client Essai');
  await page.locator('[name="customerEmail"]').fill('essai@example.com');
}

try {
  // Paid path: booking is saved while payment awaits Wix checkout.
  await enterBooking();
  await page.locator('input[name="paymentMode"][value="FULL"]').check();
  const beforeDoubleClick = postCount;
  delayMs = 250;
  await page.locator('#submit').evaluate(button => { button.click(); button.click(); });
  await page.locator('.complete').waitFor();
  delayMs = 0;
  assert.equal(postCount - beforeDoubleClick, 1, 'Two rapid clicks must create one POST');
  assert.match(await page.locator('.complete h2').textContent(), /paiement en attente/i);
  assert.match(await page.locator('.complete [role="status"]').textContent(), /pas encore confirmé/i);
  assert.equal(await page.locator('.complete a.button').getAttribute('href'), 'https://checkout.wix.com/rental/demo');
  assert.deepEqual(submissions.at(-1).assetIds, ['a1']);
  assert.deepEqual(submissions.at(-1).catalogItems, [{ id: 'required', quantity: 1 }]);
  assert.equal(submissions.at(-1).paymentMode, 'FULL');

  // Never emit javascript or untrusted checkout hrefs.
  mode = 'unsafe-checkout';
  await enterBooking();
  await page.locator('#submit').click();
  await page.locator('.complete').waitFor();
  assert.equal(await page.locator('.complete a[href^="javascript:"]').count(), 0);
  assert.equal(await page.locator('.complete a.button').count(), 0);
  assert.match(await page.locator('.complete [role="alert"]').textContent(), /indisponible/i);

  // Offline booking has no payment link, and the API must omit payment mode.
  mode = 'offline';
  await enterBooking();
  await page.locator('#submit').click();
  await page.locator('.complete').waitFor();
  assert.doesNotMatch(await page.locator('.complete h2').textContent(), /paiement en attente/i);
  assert.equal(await page.locator('.complete a.button').count(), 0);
  assert.match(await page.locator('.complete').textContent(), /Aucun paiement en ligne immédiat requis/i);
  assert.equal(submissions.at(-1).paymentMode, undefined);

  // Payment Link errors do not render confirmation, and retry stays possible.
  mode = 'payment-error';
  await enterBooking();
  await page.locator('#submit').click();
  await page.locator('.notice.error').waitFor();
  assert.equal(await page.locator('.complete').count(), 0);
  assert.equal(await page.locator('#submit').isEnabled(), true);
  mode = 'paid';
  await page.locator('#submit').click();
  await page.locator('.complete').waitFor();

  // A server conflict invalidates the stale quote while retaining explanation.
  mode = 'conflict';
  await enterBooking();
  await page.locator('#submit').click();
  await page.locator('.notice.error').waitFor();
  assert.match(await page.locator('.notice.error').textContent(), /disponible/i);
  assert.equal(await page.locator('.complete').count(), 0);
  assert.equal(await page.locator('[data-asset="a1"]').isDisabled(), true);
  assert.equal(await page.locator('#submit').isDisabled(), true);
  mode = 'paid';
  await page.locator('#search').click();
  await page.locator('[data-asset="a1"]:enabled').waitFor();
  await page.locator('[data-asset="a1"]').click();
  await page.locator('#submit').click();
  await page.locator('.complete').waitFor();

  // Failed availability refresh must not leave previous quote selectable.
  await enterBooking();
  mode = 'availability-error';
  await page.locator('#search').click();
  await page.locator('.notice.error').waitFor();
  assert.equal(await page.locator('[data-asset="a1"]').isDisabled(), true);
  assert.equal(await page.locator('#submit').isDisabled(), true);

  // Explicit pending-payment messaging remains understandable in English.
  mode = 'paid';
  await page.addInitScript(() => { window.testLanguage = 'en'; });
  await enterBooking();
  await page.locator('#submit').click();
  await page.locator('.complete').waitFor();
  assert.match(await page.locator('.complete h2').textContent(), /payment pending/i);

  assert.deepEqual(errors, [], 'Unexpected browser exceptions: ' + errors.join(', '));
  console.log('PASS: paid/offline booking, payment pending, safe checkout URL, payment failures, conflict recovery, stale availability, duplicate clicks and EN.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
