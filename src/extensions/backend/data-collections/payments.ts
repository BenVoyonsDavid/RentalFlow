import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'payments';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'RentalFlow - Payments',
  fields: [
    { type: 'TEXT', displayName: 'Réservation ID', key: 'reservationId' },
    { type: 'TEXT', displayName: 'Numéro de réservation', key: 'reservationNumber' },
    { type: 'TEXT', displayName: 'Numéro du paiement', key: 'paymentNumber' },
    { type: 'TEXT', displayName: 'Type', key: 'paymentType' },
    { type: 'TEXT', displayName: 'Méthode', key: 'method' },
    { type: 'TEXT', displayName: 'Statut', key: 'status' },
    { type: 'NUMBER', displayName: 'Montant en cents', key: 'amountCents' },
    { type: 'TEXT', displayName: 'Devise', key: 'currency' },
    { type: 'DATETIME', displayName: 'Date du paiement', key: 'paymentDate' },
    { type: 'TEXT', displayName: 'Référence', key: 'reference' },
    { type: 'TEXT', displayName: 'Notes', key: 'notes' },
  ],
  displayField: 'paymentNumber',
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  },
  indexes: [],
  initialData: [],
} satisfies DataCollection;
