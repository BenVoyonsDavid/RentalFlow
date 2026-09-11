import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'reservation-items';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'RentalFlow - Reservation Items',
  fields: [
    { type: 'TEXT', displayName: 'Réservation ID', key: 'reservationId' },
    { type: 'TEXT', displayName: 'Numéro de réservation', key: 'reservationNumber' },
    { type: 'TEXT', displayName: 'Actif ID', key: 'assetId' },
    { type: 'TEXT', displayName: 'Numéro d’actif', key: 'assetNumber' },
    { type: 'TEXT', displayName: 'Nom de l’actif', key: 'assetTitle' },
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
      name: 'reservation_item_asset_blocked',
      fields: [
        { path: 'assetId', order: 'ASC' },
        { path: 'blockedStartDateTime', order: 'ASC' },
        { path: 'blockedEndDateTime', order: 'ASC' },
      ],
      unique: false,
      caseInsensitive: false,
    },
    {
      name: 'reservation_item_reservation',
      fields: [{ path: 'reservationId', order: 'ASC' }],
      unique: false,
      caseInsensitive: false,
    },
  ],
  initialData: [],
} satisfies DataCollection;
