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
    { type: 'TEXT', displayName: 'Wix Payment Link ID', key: 'wixPaymentLinkId' },
    { type: 'TEXT', displayName: 'Wix Payment URL', key: 'wixPaymentUrl' },
    { type: 'TEXT', displayName: 'Wix Checkout ID', key: 'wixCheckoutId' },
    { type: 'TEXT', displayName: 'Wix Order ID', key: 'wixOrderId' },
    { type: 'TEXT', displayName: 'Wix Transaction ID', key: 'wixTransactionId' },
    { type: 'BOOLEAN', displayName: 'Paiement en ligne Wix', key: 'wixOnlinePayment' },
    { type: 'NUMBER', displayName: 'Solde après paiement en cents', key: 'remainingBalanceCents' },
    { type: 'TEXT', displayName: 'Notes', key: 'notes' },
  ],
  displayField: 'paymentNumber',
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  },
  indexes: [
    {
      name: 'payment_number_unique',
      fields: [{ path: 'paymentNumber', order: 'ASC' }],
      unique: true,
      caseInsensitive: true,
    },
    {
      name: 'payment_reservation',
      fields: [{ path: 'reservationId', order: 'ASC' }, { path: 'paymentDate', order: 'DESC' }],
      unique: false,
      caseInsensitive: false,
    },
    {
      name: 'payment_wix_link',
      fields: [{ path: 'wixPaymentLinkId', order: 'ASC' }],
      unique: false,
      caseInsensitive: false,
    },
  ],
  initialData: [],
} satisfies DataCollection;
