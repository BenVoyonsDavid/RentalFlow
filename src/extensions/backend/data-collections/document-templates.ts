import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'document-templates';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'RentalFlow - Document Templates',
  fields: [
    { type: 'TEXT', displayName: 'Nom du modèle', key: 'name' },
    { type: 'TEXT', displayName: 'Type de document', key: 'documentType' },
    { type: 'TEXT', displayName: 'URL logo', key: 'logoUrl' },
    { type: 'TEXT', displayName: 'Titre', key: 'titleText' },
    { type: 'TEXT', displayName: 'Texte introduction', key: 'introText' },
    { type: 'TEXT', displayName: 'Conditions / texte principal', key: 'termsText' },
    { type: 'TEXT', displayName: 'Pied de page', key: 'footerText' },
    { type: 'TEXT', displayName: 'Champs obligatoires CSV', key: 'requiredFieldsCsv' },
    { type: 'BOOLEAN', displayName: 'Modèle actif', key: 'active' },
  ],
  displayField: 'name',
  dataPermissions: {
    itemInsert: 'CMS_EDITOR',
    itemRead: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
  },
  indexes: [],
  initialData: [],
} satisfies DataCollection;
