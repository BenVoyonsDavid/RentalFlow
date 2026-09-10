import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'documents';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'RentalFlow - Documents',
  fields: [
    { type: 'TEXT', displayName: 'Réservation ID', key: 'reservationId' },
    { type: 'TEXT', displayName: 'Numéro de réservation', key: 'reservationNumber' },
    { type: 'TEXT', displayName: 'Numéro du document', key: 'documentNumber' },
    { type: 'TEXT', displayName: 'Type', key: 'documentType' },
    { type: 'TEXT', displayName: 'Statut', key: 'status' },
    { type: 'NUMBER', displayName: 'Montant en cents', key: 'amountCents' },
    { type: 'TEXT', displayName: 'Devise', key: 'currency' },
    { type: 'DATETIME', displayName: 'Date d’émission', key: 'issuedDate' },
    { type: 'DATETIME', displayName: 'Date d’envoi', key: 'sentDate' },
    { type: 'DATETIME', displayName: 'Date d’acceptation', key: 'acceptedDate' },
    { type: 'DATETIME', displayName: 'Date de signature', key: 'signedDate' },
    { type: 'DATETIME', displayName: 'Date d’échéance', key: 'dueDate' },
    { type: 'TEXT', displayName: 'Signataire', key: 'signerName' },
    { type: 'TEXT', displayName: 'URL PDF', key: 'pdfUrl' },
    { type: 'TEXT', displayName: 'Notes', key: 'notes' },
  ],
  displayField: 'documentNumber',
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  },
  indexes: [],
  initialData: [],
} satisfies DataCollection;
