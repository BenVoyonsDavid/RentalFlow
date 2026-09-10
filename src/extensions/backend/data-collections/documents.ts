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

    { type: 'TEXT', displayName: 'Modèle ID', key: 'templateId' },
    { type: 'TEXT', displayName: 'Nom du modèle', key: 'templateName' },
    { type: 'TEXT', displayName: 'URL logo', key: 'logoUrl' },
    { type: 'TEXT', displayName: 'Titre', key: 'titleText' },
    { type: 'TEXT', displayName: 'Introduction', key: 'introText' },
    { type: 'TEXT', displayName: 'Conditions / texte principal', key: 'termsText' },
    { type: 'TEXT', displayName: 'Pied de page', key: 'footerText' },
    { type: 'TEXT', displayName: 'Champs obligatoires CSV', key: 'requiredFieldsCsv' },
    { type: 'TEXT', displayName: 'Snapshot réservation JSON', key: 'snapshotJson' },

    { type: 'NUMBER', displayName: 'Sous-total en cents', key: 'subtotalCents' },
    { type: 'NUMBER', displayName: 'Rabais en cents', key: 'discountCents' },
    { type: 'NUMBER', displayName: 'Total avant taxes en cents', key: 'preTaxTotalCents' },
    { type: 'TEXT', displayName: 'Taxe 1 - nom', key: 'tax1Name' },
    { type: 'NUMBER', displayName: 'Taxe 1 en cents', key: 'tax1Cents' },
    { type: 'TEXT', displayName: 'Taxe 2 - nom', key: 'tax2Name' },
    { type: 'NUMBER', displayName: 'Taxe 2 en cents', key: 'tax2Cents' },
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
