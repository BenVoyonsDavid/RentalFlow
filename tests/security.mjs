import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = resolve('.');
const temp = await mkdtemp(join(tmpdir(), 'rentalflow-security-'));

// Substitute Wix SDK calls so server-side plan resolution can be exercised
// without a real Wix account or leaked credentials.
const wixMock = {
  name: 'wix-security-mock',
  setup(builder) {
    builder.onResolve({ filter: /^@wix\/(app-management|data|essentials)$/ },
      args => ({ path: args.path, namespace: 'wix-security-mock' }));
    builder.onLoad({ filter: /.*/, namespace: 'wix-security-mock' }, args => {
      const contents = args.path === '@wix/app-management'
        ? `export const appInstances = { getAppInstance: async () => {
            if (globalThis.__rfMockPlanError) throw Error('WIX_UNAVAILABLE');
            return globalThis.__rfMockPlanResponse;
          } };`
        : args.path === '@wix/essentials'
          ? 'export const auth = { elevate: operation => operation };'
          : 'export const items = {};';
      return { contents, loader: 'js' };
    });
  },
};

async function loadModule(source, filename) {
  const outfile = join(temp, filename);
  await build({
    entryPoints: [source],
    absWorkingDir: root,
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    plugins: [wixMock],
  });
  return import(pathToFileURL(outfile).href);
}

const plans = await loadModule('src/lib/plans.ts', 'plans.mjs');
const context = await loadModule('src/server/public-booking-context.ts', 'public-context.mjs');
const cors = await loadModule('src/lib/public-booking-cors.ts', 'cors.mjs');

const validDevSite = 'https://demo.wix-development-sites.org/';
assert.equal(plans.isWixDevelopmentSiteUrl(validDevSite), true);
for (const untrustedUrl of [
  'http://demo.wix-development-sites.org/',
  'https://wix-development-sites.org.attacker.test/',
  'https://attacker.test/?next=wix-development-sites.org',
  'https://wix-development-sites.org@attacker.test/',
  'https://attacker.test/#wix-development-sites.org',
  'javascript:wix-development-sites.org',
  '',
]) {
  assert.equal(plans.isWixDevelopmentSiteUrl(untrustedUrl), false, untrustedUrl);
}

function instance(url, isFree = true) {
  return { data: { site: { url }, instance: { isFree, billing: { packageName: 'Basic' } } } };
}
assert.equal(plans.planFromAppInstanceResponse(instance(validDevSite)), 'TRIAL');
assert.equal(plans.planFromAppInstanceResponse(instance('https://attacker.test/?dev=wix-development-sites.org')), 'BASIC');
assert.equal(plans.planFromAppInstanceResponse(instance(validDevSite, false)), 'BASIC');
assert.equal(plans.planFromAppInstanceResponse({ data: { instance: {
  isFree: true, billing: { freeTrialInfo: { status: 'IN_PROGRESS' } },
} } }), 'TRIAL');

const forgedRequest = new Request('https://app.example/api/public-booking', {
  headers: {
    Origin: validDevSite,
    Referer: validDevSite,
  },
});
try {
  globalThis.__rfMockPlanResponse = instance('https://merchant.example');
  assert.equal(await context.loadCurrentPlan(forgedRequest), 'BASIC',
    'Browser-supplied Origin/Referer must not upgrade Basic to Trial');
  globalThis.__rfMockPlanResponse = instance(validDevSite);
  assert.equal(await context.loadCurrentPlan(), 'TRIAL',
    'Trusted Wix app-instance development site must retain trial access');
  globalThis.__rfMockPlanError = true;
  assert.equal(await context.loadCurrentPlan(forgedRequest), 'NO_PLAN',
    'Wix lookup failures must not grant any paid privileges');
} finally {
  delete globalThis.__rfMockPlanResponse;
  delete globalThis.__rfMockPlanError;
}

const headers = cors.publicBookingCorsHeaders();
assert.deepEqual(headers, {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'Authorization,Content-Type,X-Wix-Linguist',
  'access-control-max-age': '600',
});
assert.equal(headers['access-control-allow-credentials'], undefined,
  'Public APIs must not enable cross-site cookie credentials');
assert(!headers['access-control-allow-headers'].includes('X-Attacker-Header'));

const api = await readFile(join(root, 'src/pages/api/public-booking.ts'), 'utf8');
const server = await readFile(join(root, 'src/server/public-booking-context.ts'), 'utf8');
const astro = await readFile(join(root, 'astro.config.mjs'), 'utf8');
assert(api.includes('publicBookingCorsHeaders()'), 'Public endpoint must use tested CORS headers');
assert(api.includes('requireActiveAppInstance()'), 'GET and POST must be authorized');
assert(!api.includes('access-control-request-headers'), 'Preflight headers must not be reflected');
assert(!server.includes("headers.get('origin')") && !server.includes("headers.get('referer')"),
  'Plan elevation must not use request headers');
assert.match(astro, /checkOrigin:\s*true/, 'Restore Astro SSR origin/CSRF checking');

console.log('PASS: trusted Wix plan resolution, forged headers, failed lookup, CORS and CSRF guards.');
