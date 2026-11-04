import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const pages = [
  'my-page', 'equipment', 'reservation-extras', 'catalog',
  'calendar', 'categories', 'customers', 'reservations', 'settings',
];

const dir = await mkdtemp(join(process.cwd(), '.wix-metadata-inspect-'));
const config = [];
try {
  for (const name of pages) {
    const file = join(dir, name + '.mjs');
    await build({
      entryPoints: [`src/extensions/dashboard/pages/${name}/${name}.extension.ts`],
      outfile: file,
      format: 'esm',
      platform: 'node',
      bundle: true,
      packages: 'external',
      logLevel: 'silent',
    });
    const { default: extension } = await import(pathToFileURL(file).href);
    const shape = extension && typeof extension === 'object' ? Object.keys(extension) : [];
    config.push({
      name,
      type: typeof extension,
      shape,
      metaData: extension?.metaData ?? null,
      dataMetaData: extension?.data?.metaData ?? null,
      optionsMetaData: extension?.options?.metaData ?? null,
      configMetaData: extension?.config?.metaData ?? null,
      repr: JSON.stringify(extension)?.slice(0, 750),
    });
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
console.log('DASHBOARD_BUILDER_RUNTIME_AUDIT');
console.log(JSON.stringify(config, null, 2));
const misses = config.filter(x => !(
  x.metaData?.searchable === true ||
  x.dataMetaData?.searchable === true ||
  x.optionsMetaData?.searchable === true ||
  x.configMetaData?.searchable === true
));
console.log(`MISSING_FROM_WIX_BUILDER_RESULT=${misses.length}/${config.length}`);

assert.equal(misses.length, 0, 'Wix builder lost metadata before app component registration');
for (const page of config) {
  const meta = page.optionsMetaData;
  assert(meta?.searchable === true, `Builder missing searchable metadata for ${page.name}`);
  assert(typeof meta?.title === 'string' && meta.title.length > 0);
  assert(typeof meta?.description === 'string' && meta.description.length > 20);
  assert(meta.description.length <= 200);
}
console.log('PASS: Nine Wix dashboard builder options contain metadata. Wix API component draft must also be checked after release.');
