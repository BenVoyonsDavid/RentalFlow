import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'catalog-items';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'RentalFlow - Catalog Items',
  fields: [
    { type: 'TEXT', displayName: 'Nom', key: 'name' },
    { type: 'TEXT', displayName: 'Description', key: 'description' },
    { type: 'TEXT', displayName: 'Type', key: 'itemType' },
    { type: 'TEXT', displayName: 'SKU', key: 'sku' },
    { type: 'TEXT', displayName: 'Catégorie ID', key: 'categoryId' },
    { type: 'TEXT', displayName: 'Nom de catégorie', key: 'categoryName' },
    { type: 'IMAGE', displayName: 'Image', key: 'image' },
    { type: 'NUMBER', displayName: 'Prix en cents', key: 'priceCents' },
    { type: 'TEXT', displayName: 'Devise', key: 'currency' },
    { type: 'TEXT', displayName: 'Mode de tarification', key: 'pricingMode' },
    { type: 'BOOLEAN', displayName: 'Taxable', key: 'taxable' },
    { type: 'BOOLEAN', displayName: 'Actif', key: 'active' },
    { type: 'BOOLEAN', displayName: 'Obligatoire', key: 'required' },
    { type: 'BOOLEAN', displayName: 'Recommandé', key: 'recommended' },
    { type: 'BOOLEAN', displayName: 'Suivi inventaire', key: 'trackInventory' },
    { type: 'NUMBER', displayName: 'Quantité en stock', key: 'stockQuantity' },
    { type: 'TEXT', displayName: 'Mode de compatibilité', key: 'compatibilityMode' },
    { type: 'TEXT', displayName: 'Catégories compatibles IDs (JSON)', key: 'applicableCategoryIdsJson' },
    { type: 'TEXT', displayName: 'Catégories compatibles legacy (JSON)', key: 'applicableCategoriesJson' },
    { type: 'TEXT', displayName: 'Tags compatibles (JSON)', key: 'applicableTagsJson' },
    { type: 'TEXT', displayName: 'Équipements compatibles (JSON)', key: 'applicableAssetIdsJson' },
    { type: 'TEXT', displayName: 'Équipements exclus (JSON)', key: 'excludedAssetIdsJson' },
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
      fields: [{ path: 'itemType', order: 'ASC' }, { path: 'active', order: 'ASC' }],
      unique: false,
    },
    {
      fields: [{ path: 'sku', order: 'ASC' }],
      unique: false,
    },
    {
      fields: [{ path: 'categoryId', order: 'ASC' }],
      unique: false,
    },
  ],
  initialData: [],
} satisfies DataCollection;
