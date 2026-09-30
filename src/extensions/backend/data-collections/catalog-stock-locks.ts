import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'catalog-stock-locks';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'RentalFlow - Catalog Stock Locks',
  fields: [
    { type: 'TEXT', displayName: 'Article catalogue ID', key: 'catalogItemId' },
    { type: 'TEXT', displayName: 'Lock token', key: 'lockToken' },
    { type: 'DATETIME', displayName: 'Expires at', key: 'expiresAt' },
  ],
  displayField: 'catalogItemId',
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  },
  indexes: [
    {
      fields: [{ path: 'catalogItemId', order: 'ASC' }],
      unique: true,
    },
  ],
  initialData: [],
} satisfies DataCollection;
