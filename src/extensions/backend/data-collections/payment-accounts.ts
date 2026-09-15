import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'payment-accounts';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'RentalFlow - Payment Accounts',
  fields: [
    { type: 'TEXT', displayName: 'Clé', key: 'settingsKey' },
    { type: 'TEXT', displayName: 'Fournisseur', key: 'provider' },
    { type: 'TEXT', displayName: 'Environnement', key: 'environment' },
    { type: 'TEXT', displayName: 'Compte fournisseur ID', key: 'accountId' },
    { type: 'TEXT', displayName: 'Statut du compte', key: 'accountStatus' },
    { type: 'BOOLEAN', displayName: 'Informations soumises', key: 'detailsSubmitted' },
    { type: 'BOOLEAN', displayName: 'Paiements activés', key: 'chargesEnabled' },
    { type: 'BOOLEAN', displayName: 'Versements activés', key: 'payoutsEnabled' },
    { type: 'TEXT', displayName: 'Exigences actuelles (JSON)', key: 'requirementsCurrentlyDueJson' },
    { type: 'TEXT', displayName: 'Exigences en retard (JSON)', key: 'requirementsPastDueJson' },
    { type: 'TEXT', displayName: 'Vérifications en attente (JSON)', key: 'requirementsPendingVerificationJson' },
    { type: 'TEXT', displayName: 'Pays', key: 'country' },
    { type: 'TEXT', displayName: 'Devise par défaut', key: 'defaultCurrency' },
    { type: 'DATETIME', displayName: 'Dernière synchronisation', key: 'lastSyncedAt' },
    { type: 'BOOLEAN', displayName: 'Actif', key: 'active' },
  ],
  displayField: 'settingsKey',
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  },
  indexes: [
    {
      fields: [{ path: 'settingsKey', order: 'ASC' }],
      unique: true,
    },
  ],
  initialData: [],
} satisfies DataCollection;
