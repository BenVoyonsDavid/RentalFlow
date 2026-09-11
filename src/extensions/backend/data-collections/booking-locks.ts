import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'booking-locks';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'RentalFlow - Booking Locks',
  fields: [
    { type: 'TEXT', displayName: 'Asset ID', key: 'assetId' },
    { type: 'TEXT', displayName: 'Lock token', key: 'lockToken' },
    { type: 'DATETIME', displayName: 'Expires at', key: 'expiresAt' },
  ],
  displayField: 'assetId',
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  },
  indexes: [
    {
      fields: [{ path: 'assetId', order: 'ASC' }],
      unique: true,
      caseInsensitive: false,
    },
  ],
  initialData: [],
} satisfies DataCollection;
