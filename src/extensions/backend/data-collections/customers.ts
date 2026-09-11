import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'customers';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'RentalFlow - Customers',
  fields: [
    { type: 'TEXT', displayName: 'Numéro client', key: 'customerNumber' },
    { type: 'TEXT', displayName: 'Prénom', key: 'firstName' },
    { type: 'TEXT', displayName: 'Nom', key: 'lastName' },
    { type: 'TEXT', displayName: 'Entreprise', key: 'companyName' },
    { type: 'TEXT', displayName: 'Courriel', key: 'email' },
    { type: 'TEXT', displayName: 'Téléphone', key: 'phone' },
    { type: 'TEXT', displayName: 'Adresse', key: 'addressLine1' },
    { type: 'TEXT', displayName: 'Adresse 2', key: 'addressLine2' },
    { type: 'TEXT', displayName: 'Ville', key: 'city' },
    { type: 'TEXT', displayName: 'Province / État', key: 'region' },
    { type: 'TEXT', displayName: 'Code postal', key: 'postalCode' },
    { type: 'TEXT', displayName: 'Pays', key: 'country' },
    { type: 'NUMBER', displayName: 'Rabais client en pourcentage', key: 'discountPercent' },
    { type: 'TEXT', displayName: 'Notes', key: 'notes' },
    { type: 'BOOLEAN', displayName: 'Actif', key: 'active' },
  ],
  displayField: 'customerNumber',
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  },
  indexes: [
    {
      fields: [{ path: 'customerNumber', order: 'ASC' }],
      unique: true,
      caseInsensitive: true,
    },
    {
      fields: [{ path: 'email', order: 'ASC' }],
      unique: false,
      caseInsensitive: true,
    },
  ],
  initialData: [],
} satisfies DataCollection;
