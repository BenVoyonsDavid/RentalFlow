import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'activity-log';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'RentalFlow - Activity Log',
  fields: [
    { type: 'TEXT', displayName: 'Réservation ID', key: 'reservationId' },
    { type: 'TEXT', displayName: 'Numéro de réservation', key: 'reservationNumber' },
    { type: 'TEXT', displayName: 'Type d’action', key: 'actionType' },
    { type: 'TEXT', displayName: 'Description', key: 'description' },
    { type: 'TEXT', displayName: 'Auteur', key: 'actor' },
    { type: 'DATETIME', displayName: 'Date', key: 'eventDate' },
  ],
  displayField: 'description',
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  },
  indexes: [],
  initialData: [],
} satisfies DataCollection;
