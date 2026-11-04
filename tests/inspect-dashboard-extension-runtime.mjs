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
