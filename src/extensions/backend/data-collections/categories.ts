import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'categories';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'RentalFlow - Categories',
  fields: [
    { type: 'TEXT', displayName: 'Nom', key: 'name' },
    { type: 'TEXT', displayName: 'Clé', key: 'key' },
    { type: 'TEXT', displayName: 'Description', key: 'description' },
    { type: 'BOOLEAN', displayName: 'Équipements', key: 'forEquipment' },
    { type: 'BOOLEAN', displayName: 'Produits', key: 'forProducts' },
    { type: 'BOOLEAN', displayName: 'Extras et services', key: 'forExtras' },
    { type: 'BOOLEAN', displayName: 'Actif', key: 'active' },
    { type: 'NUMBER', displayName: 'Ordre', key: 'sortOrder' },
  ],
  displayField: 'name',
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  },
  indexes: [
    {
      fields: [{ path: 'key', order: 'ASC' }],
      unique: true,
    },
    {
      fields: [{ path: 'active', order: 'ASC' }, { path: 'sortOrder', order: 'ASC' }],
      unique: false,
    },
  ],
  initialData: [],
} satisfies DataCollection;
