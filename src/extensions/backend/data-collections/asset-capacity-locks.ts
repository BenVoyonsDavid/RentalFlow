import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'asset-capacity-locks';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'RentalFlow - Asset Capacity Locks',
  fields: [
    { type: 'TEXT', displayName: 'Lock key', key: 'lockKey' },
    { type: 'TEXT', displayName: 'Lock token', key: 'lockToken' },
    { type: 'DATETIME', displayName: 'Expires at', key: 'expiresAt' },
  ],
  displayField: 'lockKey',
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  },
  indexes: [
    {
      fields: [{ path: 'lockKey', order: 'ASC' }],
      unique: true,
    },
  ],
  initialData: [],
} satisfies DataCollection;
