import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const expected = new Map([
  ['equipment', 'Équipements'],
  ['reservation-extras', 'Extras de réservation'],
  ['catalog', 'Catalogue'],
  ['calendar', 'Calendrier'],
  ['my-page', 'Tableau de bord'],
  ['categories', 'Catégories'],
  ['customers', 'Clients'],
  ['reservations', 'Réservations'],
  ['settings', 'Paramètres'],
]);

for (const [dir, title] of expected) {
  const path = `src/extensions/dashboard/pages/${dir}/${dir}.extension.ts`;
  const content = await readFile(path, 'utf8');
  const match = content.match(/metaData:\s*\{\s*searchable:\s*true,\s*title:\s*(['"])([^'"]+)\1,\s*description:\s*(['"])([^'"]+)\3,?\s*\}/);
  assert(match, `${path}: metadata must contain searchable, title and description`);
  assert.equal(match[2], title, `Missing search title for ${dir}`);
  assert(match[4].trim().length > 20, `Description too short for ${dir}`);
  assert(Array.from(match[4]).length <= 200, `Description exceeds Wix's 200-character limit in ${dir}`);
  assert.equal((content.match(/metaData:/g) || []).length, 1, `Duplicate metadata in ${dir}`);
}

const main = await readFile('src/extensions.ts', 'utf8');
for (const [dir] of expected) {
  assert(main.includes(`./extensions/dashboard/pages/${dir}/${dir}.extension.ts`), `Page ${dir} is not registered`);
}

const dashboard = await readFile('src/extensions/dashboard/pages/my-page/my-page.tsx', 'utf8');
const assets = await readFile('src/extensions/dashboard/pages/equipment/equipment.tsx', 'utf8');
const reservations = await readFile('src/extensions/dashboard/pages/reservations/reservations-v2.tsx', 'utf8');
assert(dashboard.includes('dashboardLoadedTracked.current = true;'));
assert(dashboard.includes("sendRentalFlowBiEvent({ eventName: 'APP_DASHBOARD_LOADED' })"));
assert(assets.includes("sendRentalFlowBiEvent({ eventName: 'CUSTOM', customEventName: 'rentalflow_first_asset_created' })"));
assert(reservations.includes("sendRentalFlowBiEvent({ eventName: 'PRIMARY_ACTION_PERFORMED' })"));
assert(reservations.includes("sendRentalFlowBiEvent({ eventName: 'CUSTOM', customEventName: 'rentalflow_reservation_created' })"));
assert(dashboard.indexOf("sendRentalFlowBiEvent({ eventName: 'APP_DASHBOARD_LOADED' })") > dashboard.indexOf('setLastUpdated(new Date())'));
assert(reservations.indexOf("sendRentalFlowBiEvent({ eventName: 'PRIMARY_ACTION_PERFORMED' })") > reservations.indexOf('const created = payload.reservation;'));

const temp = await mkdtemp(join(tmpdir(), 'rentalflow-app-market-'));
const dest = join(temp, 'bi-events.mjs');
await build({ entryPoints: ['src/lib/bi-events.ts'], bundle: true, format: 'esm', platform: 'node', outfile: dest });
const { normalizeBiEventInput } = await import(pathToFileURL(dest).href);
assert.equal(normalizeBiEventInput({ eventName: 'APP_DASHBOARD_LOADED' })?.eventName, 'APP_DASHBOARD_LOADED');
assert.equal(normalizeBiEventInput({ eventName: 'PRIMARY_ACTION_PERFORMED' })?.eventName, 'PRIMARY_ACTION_PERFORMED');
assert.equal(normalizeBiEventInput({ eventName: 'CUSTOM', customEventName: 'rentalflow_first_asset_created' })?.customEventName, 'rentalflow_first_asset_created');
assert.equal(normalizeBiEventInput({ eventName: 'CUSTOM', customEventName: 'unexpected' }), null);
assert.equal(normalizeBiEventInput({ eventName: 'NOT_A_REAL_EVENT' }), null);
console.log('PASS: 9 searchable Wix dashboard pages, correct descriptions, safe BI event call sites and event validation.');

const lifecycle = [
  ['app-installed', 'onAppInstanceInstalled'],
  ['app-plan-changed', 'onAppInstancePaidPlanChanged'],
  ['app-removed', 'onAppInstanceRemoved'],
];
const appExtensionRoot = await readFile('src/extensions.ts', 'utf8');
for (const [slug, fn] of lifecycle) {
  const base = `src/extensions/backend/events/${slug}/${slug}`;
  const builder = await readFile(`${base}.extension.ts`, 'utf8');
  const handler = await readFile(`${base}.ts`, 'utf8');
  assert(builder.includes('extensions.event({'), `Missing Wix event builder for ${slug}`);
  assert(builder.includes(`./extensions/backend/events/${slug}/${slug}.ts`));
  assert(appExtensionRoot.includes(`./extensions/backend/events/${slug}/${slug}.extension.ts`));
  assert(handler.includes(`appInstances.${fn}(`), `Incorrect Wix lifecycle SDK event: ${slug}`);
  assert(!handler.includes('items.remove(') && !handler.includes('items.update('));
  assert(!handler.includes('event.entity') && !handler.includes('event.data'));
}
console.log('PASS: 3 Wix App Market lifecycle event extensions are registered with no tenant-data side effects.');
