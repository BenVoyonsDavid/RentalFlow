import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = await mkdtemp(join(tmpdir(),'rentalflow-i18n-unit-'));
const serviceDouble = { name: 'wix-no-network', setup(api) {
  api.onResolve({filter:/^@wix\//},({path})=>({path,namespace:'mock'}));
  api.onLoad({filter:/.*/,namespace:'mock'},({path})=>({contents:
    path==='@wix/essentials' ? `export const auth={elevate:fn=>fn,async getTokenInfo(){return {instanceId:'test'}}};` :
    path==='@wix/data' ? `export const items={query(){throw new Error('TEST_QUERY_FAILURE')},insert(){throw new Error('UNEXPECTED_WRITE')},update(){throw new Error('UNEXPECTED_WRITE')}};` : 'export const paymentLinks={};'
  }));
} };
try {
  await build({entryPoints:['src/lib/i18n/index.ts','src/pages/api/public-booking.ts'],outdir:directory,bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'},plugins:[serviceDouble]});
  const i18n=await import(pathToFileURL(join(directory,'lib/i18n/index.mjs')));
  const api=await import(pathToFileURL(join(directory,'pages/api/public-booking.mjs')));
  assert.equal(i18n.normalizeLanguage('en-US'),'en');
  assert.equal(i18n.normalizeLanguage('fr_CA'),'fr');
  assert.equal(i18n.normalizeLanguage('de-DE'),undefined);
  assert.equal(i18n.translate('Réservation','en'),'Reservation');
  assert.equal(i18n.translate('Réservation','fr'),'Réservation');
  assert.equal(i18n.translate('Nom personnalisé inconnu','en'),'Nom personnalisé inconnu');
  const name='Élodie $& ${x} <script>';
  assert.equal(i18n.translate('Réservation {0} créée.','en',{0:name}),`Reservation ${name} created.`);
  assert.equal(i18n.formatFeedback(i18n.feedback('Réservation {0} créée.',{0:'RES-1'}),'en'),'Reservation RES-1 created.');
  assert.equal(i18n.formatFeedback(i18n.feedback('Réservation {0} créée.',{0:'RES-1'}),'fr'),'Réservation RES-1 créée.');
  const english=JSON.parse(await readFile('src/lib/i18n/en.json','utf8'));
  for(const [source,target] of Object.entries(english)) {
    assert.ok(target.trim(),`Empty translation: ${source}`);
    const sourceKeys=[...source.matchAll(/\{(\w+)\}/g)].map(m=>m[1]);
    for(const [,key] of target.matchAll(/\{(\w+)\}/g)) assert.ok(sourceKeys.includes(key),`Unknown parameter ${key}: ${source}`);
  }
  assert.notEqual(new Intl.NumberFormat(i18n.localeFor('en'),{style:'currency',currency:'CAD'}).format(1234.56),new Intl.NumberFormat(i18n.localeFor('fr'),{style:'currency',currency:'CAD'}).format(1234.56));
  // Concurrent requests must not leak locale across the server.
  const originalError=console.error;console.error=()=>{};
  try {
    const responses=await Promise.all(['en','fr','en','fr'].map(lang=>api.GET({request:new Request(`https://example.test/api/public-booking?lang=${lang}`)})));
    const bodies=await Promise.all(responses.map(r=>r.json()));
    assert.deepEqual(bodies.map(b=>b.error),['Unable to load online booking.','Impossible de charger la réservation en ligne.','Unable to load online booking.','Impossible de charger la réservation en ligne.']);
    assert.ok(bodies.every(b=>b.errorKey==='Impossible de charger la réservation en ligne.'));
    for(const lang of ['fr','en']) {
      const response=await api.POST({request:new Request(`https://example.test/api/public-booking?lang=${lang}`,{method:'POST',body:JSON.stringify({startDateTime:'2030-06-01T10:00:00Z',endDateTime:'2030-06-03T10:00:00Z',assetIds:[]})})});
      assert.equal(response.status,400);assert.equal((await response.json()).error,lang==='en'?'Invalid equipment selection.':'Sélection d’équipement invalide.');
    }
  } finally {console.error=originalError;}
  console.log(`PASS ${Object.keys(english).length} translations, interpolation safety, formatting and request language isolation`);
} finally {await rm(directory,{recursive:true,force:true});}
