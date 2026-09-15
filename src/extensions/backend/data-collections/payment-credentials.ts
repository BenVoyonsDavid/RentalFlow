import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'payment-credentials';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'RentalFlow - Payment Credentials',
  fields: [
    { type: 'TEXT', displayName: 'Clé', key: 'credentialKey' },
    { type: 'TEXT', displayName: 'Fournisseur', key: 'provider' },
    { type: 'TEXT', displayName: 'Environnement', key: 'environment' },
    { type: 'TEXT', displayName: 'Installation ID', key: 'installationId' },
    { type: 'TEXT', displayName: 'Marchand fournisseur ID', key: 'merchantId' },
    { type: 'TEXT', displayName: 'Jeton accès chiffré', key: 'accessTokenEncrypted' },
    { type: 'TEXT', displayName: 'Jeton renouvellement chiffré', key: 'refreshTokenEncrypted' },
    { type: 'DATETIME', displayName: 'Expiration jeton', key: 'tokenExpiresAt' },
    { type: 'TEXT', displayName: 'Portées OAuth (JSON)', key: 'scopesJson' },
    { type: 'DATETIME', displayName: 'Dernier renouvellement', key: 'lastRefreshedAt' },
    { type: 'BOOLEAN', displayName: 'Actif', key: 'active' },
  ],
  displayField: 'credentialKey',
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  },
  indexes: [
    {
      fields: [{ path: 'credentialKey', order: 'ASC' }],
      unique: true,
    },
  ],
  initialData: [],
} satisfies DataCollection;
