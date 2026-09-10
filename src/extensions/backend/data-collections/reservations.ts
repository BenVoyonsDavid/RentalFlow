import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'reservations';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'RentalFlow - Reservations',
  fields: [
    { type: 'TEXT', displayName: 'Numéro de réservation', key: 'reservationNumber' },
    { type: 'TEXT', displayName: 'ID client', key: 'customerId' },
    { type: 'TEXT', displayName: 'Numéro client', key: 'customerNumber' },
    { type: 'TEXT', displayName: 'Client', key: 'customerName' },
    { type: 'TEXT', displayName: 'Courriel', key: 'customerEmail' },
    { type: 'TEXT', displayName: 'Téléphone', key: 'customerPhone' },
    { type: 'DATETIME', displayName: 'Début de location', key: 'startDateTime' },
    { type: 'DATETIME', displayName: 'Fin de location', key: 'endDateTime' },
    { type: 'NUMBER', displayName: 'Buffer avant en heures', key: 'bufferBeforeHours' },
    { type: 'NUMBER', displayName: 'Buffer après en heures', key: 'bufferAfterHours' },
    { type: 'TEXT', displayName: 'Statut', key: 'status' },
    { type: 'NUMBER', displayName: 'Sous-total en cents', key: 'subtotalCents' },
    { type: 'NUMBER', displayName: 'Rabais client en pourcentage', key: 'customerDiscountPercent' },
    { type: 'NUMBER', displayName: 'Rabais client en cents', key: 'discountCents' },
    { type: 'NUMBER', displayName: 'Total en cents', key: 'totalCents' },
    { type: 'TEXT', displayName: 'Devise', key: 'currency' },
    { type: 'TEXT', displayName: 'Notes', key: 'notes' },
  ],
  displayField: 'reservationNumber',
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  },
  indexes: [],
  initialData: [],
} satisfies DataCollection;
