import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'inspections';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'RentalFlow - Inspections',
  fields: [
    { type: 'TEXT', displayName: 'Réservation ID', key: 'reservationId' },
    { type: 'TEXT', displayName: 'Numéro de réservation', key: 'reservationNumber' },
    { type: 'TEXT', displayName: 'Numéro inspection', key: 'inspectionNumber' },
    { type: 'TEXT', displayName: 'Type', key: 'inspectionType' },
    { type: 'TEXT', displayName: 'Statut', key: 'status' },
    { type: 'TEXT', displayName: 'Actif ID', key: 'assetId' },
    { type: 'TEXT', displayName: 'Numéro actif', key: 'assetNumber' },
    { type: 'TEXT', displayName: 'Nom actif', key: 'assetTitle' },
    { type: 'TEXT', displayName: 'État', key: 'condition' },
    { type: 'BOOLEAN', displayName: 'Dommage constaté', key: 'hasDamage' },
    { type: 'TEXT', displayName: 'Description dommage', key: 'damageDescription' },
    { type: 'NUMBER', displayName: 'Montant dommage en cents', key: 'damageAmountCents' },
    { type: 'TEXT', displayName: 'Photos', key: 'photoUrls' },
    { type: 'TEXT', displayName: 'Signataire', key: 'signerName' },
    { type: 'DATETIME', displayName: 'Date inspection', key: 'inspectionDate' },
    { type: 'TEXT', displayName: 'Notes', key: 'notes' },
  ],
  displayField: 'inspectionNumber',
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  },
  indexes: [],
  initialData: [],
} satisfies DataCollection;
