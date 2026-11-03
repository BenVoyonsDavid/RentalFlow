import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = resolve('.');
const temp = await mkdtemp(join(tmpdir(), 'rentalflow-management-ui-'));
const outfile = join(temp, 'management-filters.mjs');
await build({ entryPoints: ['src/lib/management-filters.ts'], bundle: true, platform: 'node', format: 'esm', outfile });
const { filterManagementAssets, filterManagementReservations, normalizeManagementSearch, getOperationsForDashboard } = await import(pathToFileURL(outfile).href);

assert.equal(normalizeManagementSearch('  ÉQUIPEMENT   RÉSERVÉ  '), 'equipement reserve');
const assets = [
  { _id: '1', title: 'Éclairage LED', assetNumber: 'LED-001', productType: 'Lumière', categoryName: 'Événementiel', status: 'AVAILABLE' },
  { _id: '2', title: 'Caméra vidéo', assetNumber: 'CAM-002', productType: 'Vidéo', serialNumber: 'SN-ABCDE', status: 'RENTED' },
  { _id: '3', title: 'Roulotte', assetNumber: 'RV-003', categoryName: 'Camping', status: 'MAINTENANCE' },
];
assert.deepEqual(filterManagementAssets(assets, '', 'ALL').map(a => a._id), ['1', '2', '3']);
assert.deepEqual(filterManagementAssets(assets, 'eclairage led').map(a => a._id), ['1']);
assert.deepEqual(filterManagementAssets(assets, 'cAm 002').map(a => a._id), ['2']);
assert.deepEqual(filterManagementAssets(assets, 'sn-abcde', 'RENTED').map(a => a._id), ['2']);
assert.deepEqual(filterManagementAssets(assets, 'éclairage', 'RENTED'), []);
assert.deepEqual(filterManagementAssets(assets, 'camping', 'MAINTENANCE').map(a => a._id), ['3']);
assert.deepEqual(filterManagementAssets(assets, 'aucun'), []);

const now = new Date('2030-06-10T12:00:00Z');
const reservations = [
  { _id: '1', reservationNumber: 'RF-001', customerName: 'Émilie Dubé', customerEmail: 'emilie@example.org', status: 'CONFIRMED', startDateTime: '2030-06-10T14:00:00Z', endDateTime: '2030-06-12T16:00:00Z' },
  { _id: '2', reservationNumber: 'RF-002', customerName: 'Jean Noël', status: 'RENTED', startDateTime: '2030-06-08T10:00:00Z', endDateTime: '2030-06-10T09:00:00Z' },
  { _id: '3', reservationNumber: 'RF-003', customerName: 'Marie Test', status: 'RENTED', startDateTime: '2030-06-09T10:00:00Z', endDateTime: '2030-06-10T18:00:00Z' },
  { _id: '4', reservationNumber: 'RF-004', customerName: 'Terminée', status: 'COMPLETED', startDateTime: '2030-05-01T09:00:00Z', endDateTime: '2030-05-03T11:00:00Z' },
  { _id: '5', reservationNumber: 'RF-005', customerName: 'Annulée', status: 'CANCELLED', startDateTime: '2030-06-14T09:00:00Z', endDateTime: '2030-06-15T11:00:00Z' },
  { _id: '6', reservationNumber: 'RF-006', customerName: 'Échec', status: 'ERROR', startDateTime: '2030-06-10T09:00:00Z', endDateTime: '2030-06-11T09:00:00Z' },
  { _id: '7', reservationNumber: 'RF-007', customerName: 'Sans retour', status: 'RENTED', startDateTime: '2030-06-02T09:00:00Z' },
];
assert.deepEqual(filterManagementReservations(reservations, 'emilie', 'ALL', now).map(r=>r._id), ['1']);
assert.deepEqual(filterManagementReservations(reservations, 'rf-002', 'IN_PROGRESS', now).map(r=>r._id), ['2']);
assert.deepEqual(filterManagementReservations(reservations, '', 'UPCOMING', now).map(r=>r._id), ['1']);
assert.deepEqual(filterManagementReservations(reservations, '', 'COMPLETED', now).map(r=>r._id), ['4']);
assert.deepEqual(filterManagementReservations(reservations, '', 'CANCELLED', now).map(r=>r._id), ['5']);
assert.equal(filterManagementReservations(reservations, '', 'ALL', now).length, 6);
assert.deepEqual(filterManagementReservations(reservations, 'Noel', 'ALL', now).map(r=>r._id), ['2']);

const operations = getOperationsForDashboard(reservations, now);
assert.deepEqual(operations.departures.map(r=>r._id), ['1']);
assert.deepEqual(operations.returns.map(r=>r._id), ['2', '3']);
assert.deepEqual(operations.late.map(r=>r._id), ['2'], 'Missing dates never count as overdue');
assert.deepEqual(operations.prepare.map(r=>r._id), ['1']);
assert.deepEqual(operations.upcoming.map(r=>r._id), ['1']);

const dashboard = await readFile(join(root,'src/extensions/dashboard/pages/my-page/my-page.tsx'),'utf8');
const equipment = await readFile(join(root,'src/extensions/dashboard/pages/equipment/equipment.tsx'),'utf8');
const reservationsPage = await readFile(join(root,'src/extensions/dashboard/pages/reservations/reservations-v2.tsx'),'utf8');
assert(dashboard.includes('getOperationsForDashboard(reservations)'));
assert(dashboard.includes('setRefreshKey((key) => key + 1)'));
assert(dashboard.includes('aria-pressed={active}'));
assert(dashboard.includes('Réservations actives'));
assert(!dashboard.includes('const Quick:'));
assert(equipment.includes('filterManagementAssets(assets, search, filter)'));
assert(equipment.includes('id="rf-equipment-search"'));
assert(equipment.includes('aria-pressed={filter === option.key}'));
assert(reservationsPage.includes("useState<ViewMode>('LIST')"));
assert(reservationsPage.includes('filterManagementReservations(sortedReservations, reservationSearch, reservationFilter)'));
assert(reservationsPage.includes('aria-pressed={reservationFilter === option.key}'));
assert(reservationsPage.includes('Effacer les filtres'));
console.log('PASS: management search, equipment status, reservation list, operational queues and dashboard interaction wiring.');
