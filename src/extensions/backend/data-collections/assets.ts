import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'assets';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'RentalFlow - Assets',
  fields: [
    {
      type: 'TEXT',
      displayName: 'Nom',
      key: 'title',
    },
    {
      type: 'TEXT',
      displayName: 'Numéro d’actif',
      key: 'assetNumber',
    },
    {
      type: 'TEXT',
      displayName: 'Type de produit',
      key: 'productType',
    },
    {
      type: 'TEXT',
      displayName: 'Statut',
      key: 'status',
    },
    {
      type: 'NUMBER',
      displayName: 'Tarif journalier en cents',
      key: 'dailyRateCents',
    },
    {
      type: 'NUMBER',
      displayName: 'Tarif hebdomadaire en cents',
      key: 'weeklyRateCents',
    },
    {
      type: 'NUMBER',
      displayName: 'Tarif mensuel en cents',
      key: 'monthlyRateCents',
    },
    {
      type: 'NUMBER',
      displayName: 'Rabais après nombre de jours',
      key: 'discountAfterDays',
    },
    {
      type: 'NUMBER',
      displayName: 'Rabais longue durée en pourcentage',
      key: 'discountPercent',
    },
    {
      type: 'TEXT',
      displayName: 'Devise',
      key: 'currency',
    },
    {
      type: 'TEXT',
      displayName: 'Numéro de série',
      key: 'serialNumber',
    },
    {
      type: 'IMAGE',
      displayName: 'Image',
      key: 'image',
    },
    {
      type: 'TEXT',
      displayName: 'Notes',
      key: 'notes',
    },
    {
      type: 'BOOLEAN',
      displayName: 'Actif',
      key: 'active',
    },
  ],
  displayField: 'title',
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  },
  indexes: [],
  initialData: [],
} satisfies DataCollection;
