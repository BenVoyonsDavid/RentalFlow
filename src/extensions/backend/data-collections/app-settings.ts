import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'app-settings';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'RentalFlow - App Settings',
  fields: [
    { type: 'TEXT', displayName: 'Clé', key: 'settingsKey' },
    { type: 'TEXT', displayName: 'Nom entreprise', key: 'companyName' },
    { type: 'TEXT', displayName: 'URL logo', key: 'logoUrl' },
    { type: 'TEXT', displayName: 'Devise par défaut', key: 'currency' },
    { type: 'NUMBER', displayName: 'Buffer avant par défaut (h)', key: 'defaultBufferBeforeHours' },
    { type: 'NUMBER', displayName: 'Buffer après par défaut (h)', key: 'defaultBufferAfterHours' },
    { type: 'BOOLEAN', displayName: 'Taxes activées', key: 'taxesEnabled' },
    { type: 'TEXT', displayName: 'Taxe 1 - nom', key: 'tax1Name' },
    { type: 'NUMBER', displayName: 'Taxe 1 - taux (%)', key: 'tax1Rate' },
    { type: 'TEXT', displayName: 'Taxe 2 - nom', key: 'tax2Name' },
    { type: 'NUMBER', displayName: 'Taxe 2 - taux (%)', key: 'tax2Rate' },
    { type: 'BOOLEAN', displayName: 'Taxe 2 composée', key: 'tax2Compound' },
    { type: 'BOOLEAN', displayName: 'Dépôt activé par défaut', key: 'defaultDepositEnabled' },
    { type: 'TEXT', displayName: 'Type dépôt par défaut', key: 'defaultDepositType' },
    { type: 'NUMBER', displayName: 'Valeur dépôt par défaut', key: 'defaultDepositValue' },
    { type: 'TEXT', displayName: 'Modèle devis par défaut', key: 'defaultQuoteTemplateId' },
    { type: 'TEXT', displayName: 'Modèle contrat par défaut', key: 'defaultContractTemplateId' },
    { type: 'TEXT', displayName: 'Modèle facture par défaut', key: 'defaultInvoiceTemplateId' },
    { type: 'TEXT', displayName: 'Fournisseur de paiement', key: 'paymentProvider' },
    { type: 'BOOLEAN', displayName: 'Actif', key: 'active' },
  ],
  displayField: 'settingsKey',
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  },
  indexes: [],
  initialData: [],
} satisfies DataCollection;
