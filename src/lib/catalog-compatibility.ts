export type CatalogCompatibilityMode = 'ALL' | 'CATEGORIES' | 'TAGS' | 'ASSETS';

export type CatalogCompatibleAsset = {
  _id?: string;
  productType?: string;
  categoryId?: string;
  categoryName?: string;
  catalogTagsJson?: string;
};

export type CatalogCompatibilityRule = {
  compatibilityMode?: CatalogCompatibilityMode;
  applicableCategoryIdsJson?: string;
  applicableCategoriesJson?: string;
  applicableTagsJson?: string;
  applicableAssetIdsJson?: string;
  excludedAssetIdsJson?: string;
};

export function normalizeCatalogKey(value: string): string {
  return value.trim().toLowerCase();
}

export function decodeCatalogList(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

export function encodeCatalogList(values: string[]): string {
  return JSON.stringify([...new Set(values.map((item) => item.trim()).filter(Boolean))]);
}

export function catalogItemAppliesToAsset(rule: CatalogCompatibilityRule, asset: CatalogCompatibleAsset): boolean {
  const assetId = asset._id || '';
  if (assetId && decodeCatalogList(rule.excludedAssetIdsJson).includes(assetId)) return false;

  const mode = rule.compatibilityMode || 'ALL';
  if (mode === 'ALL') return true;

  if (mode === 'ASSETS') {
    return Boolean(assetId && decodeCatalogList(rule.applicableAssetIdsJson).includes(assetId));
  }

  if (mode === 'CATEGORIES') {
    const acceptedCategoryIds = decodeCatalogList(rule.applicableCategoryIdsJson);
    if (asset.categoryId && acceptedCategoryIds.includes(asset.categoryId)) return true;

    // Backward compatibility for merchants that created compatibility rules
    // before first-class RentalFlow categories existed.
    const category = normalizeCatalogKey(asset.categoryName || asset.productType || '');
    return Boolean(category && decodeCatalogList(rule.applicableCategoriesJson).map(normalizeCatalogKey).includes(category));
  }

  const assetTags = decodeCatalogList(asset.catalogTagsJson).map(normalizeCatalogKey);
  if (!assetTags.length) return false;
  const acceptedTags = new Set(decodeCatalogList(rule.applicableTagsJson).map(normalizeCatalogKey));
  return assetTags.some((tag) => acceptedTags.has(tag));
}

export function catalogItemAppliesToAnyAsset(rule: CatalogCompatibilityRule, assets: CatalogCompatibleAsset[]): boolean {
  return assets.some((asset) => catalogItemAppliesToAsset(rule, asset));
}
