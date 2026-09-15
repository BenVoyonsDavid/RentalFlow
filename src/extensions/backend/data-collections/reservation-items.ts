import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'reservation-items';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'RentalFlow - Reservation Items',
  fields: [
    { type: 'TEXT', displayName: 'Réservation ID', key: 'reservationId' },
    { type: 'TEXT', displayName: 'Numéro de réservation', key: 'reservationNumber' },
    { type: 'TEXT', displayName: 'Type de ligne', key: 'lineType' },
    { type: 'TEXT', displayName: 'Actif ID', key: 'assetId' },
    { type: 'TEXT', displayName: 'Numéro d’actif', key: 'assetNumber' },
    { type: 'TEXT', displayName: 'Nom de l’actif', key: 'assetTitle' },
    { type: 'TEXT', displayName: 'Article catalogue ID', key: 'catalogItemId' },
    { type: 'TEXT', displayName: 'Type article catalogue', key: 'catalogItemType' },
    { type: 'TEXT', displayName: 'Nom article', key: 'itemName' },
    { type: 'TEXT', displayName: 'SKU', key: 'sku' },
    { type: 'NUMBER', displayName: 'Quantité', key: 'quantity' },
    { type: 'NUMBER', displayName: 'Prix unitaire en cents', key: 'unitPriceCents' },
    { type: 'BOOLEAN', displayName: 'Taxable', key: 'taxable' },
    { type: 'DATETIME', displayName: 'Début facturé', key: 'startDateTime' },
    { type: 'DATETIME', displayName: 'Fin facturée', key: 'endDateTime' },
    { type: 'DATETIME', displayName: 'Début bloqué', key: 'blockedStartDateTime' },
    { type: 'DATETIME', displayName: 'Fin bloquée', key: 'blockedEndDateTime' },
    { type: 'NUMBER', displayName: 'Buffer avant en heures', key: 'bufferBeforeHours' },
    { type: 'NUMBER', displayName: 'Buffer après en heures', key: 'bufferAfterHours' },
    { type: 'NUMBER', displayName: 'Nombre de jours facturés', key: 'billableDays' },
    { type: 'NUMBER', displayName: 'Total de ligne en cents', key: 'lineTotalCents' },
    { type: 'TEXT', displayName: 'Mode tarifaire appliqué', key: 'pricingMode' },
    { type: 'TEXT', displayName: 'Devise', key: 'currency' },
    { type: 'TEXT', displayName: 'Statut', key: 'status' },
  ],
  displayField: 'assetTitle',
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  },
  indexes: [
    {
      fields: [
        { path: 'assetId', order: 'ASC' },
        { path: 'blockedStartDateTime', order: 'ASC' },
        { path: 'blockedEndDateTime', order: 'ASC' },
      ],
      unique: false,
    },
    {
      fields: [
        { path: 'blockedStartDateTime', order: 'ASC' },
        { path: 'blockedEndDateTime', order: 'ASC' },
      ],
      unique: false,
    },
    {
      fields: [{ path: 'reservationId', order: 'ASC' }],
      unique: false,
    },
    {
      fields: [{ path: 'catalogItemId', order: 'ASC' }],
      unique: false,
    },
  ],
  initialData: [],
} satisfies DataCollection;
