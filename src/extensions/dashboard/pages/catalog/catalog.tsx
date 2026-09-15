import type { CSSProperties, FC, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { items } from '@wix/data';
import { Page, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import { decodeCatalogList, encodeCatalogList, type CatalogCompatibilityMode } from '../../../../lib/catalog-compatibility';
import { useRentalFlowI18n } from '../../../../intl';

const CATALOG = '@pilotedavid1/rental-flow/catalog-items';
const ASSETS = '@pilotedavid1/rental-flow/assets';

type CatalogItemType = 'PRODUCT' | 'ADDON' | 'SERVICE';
type PricingMode = 'FIXED' | 'PER_UNIT' | 'PER_DAY' | 'PER_RESERVATION';

type Asset = {
  _id?: string;
  title?: string;
  assetNumber?: string;
  productType?: string;
  catalogTagsJson?: string;
  active?: boolean;
};

type CatalogItem = {
  _id?: string;
  name?: string;
  description?: string;
  itemType?: CatalogItemType;
  sku?: string;
  image?: unknown;
  priceCents?: number;
  currency?: string;
  pricingMode?: PricingMode;
  taxable?: boolean;
  active?: boolean;
  required?: boolean;
  recommended?: boolean;
  trackInventory?: boolean;
  stockQuantity?: number;
  compatibilityMode?: CatalogCompatibilityMode;
  applicableCategoriesJson?: string;
  applicableTagsJson?: string;
  applicableAssetIdsJson?: string;
  excludedAssetIdsJson?: string;
};

type FormState = {
  name: string;
  description: string;
  itemType: CatalogItemType;
  sku: string;
  price: string;
  currency: string;
  pricingMode: PricingMode;
  taxable: boolean;
  active: boolean;
  required: boolean;
  recommended: boolean;
  trackInventory: boolean;
  stockQuantity: string;
  compatibilityMode: CatalogCompatibilityMode;
  categories: string[];
  tags: string;
  assetIds: string[];
  excludedAssetIds: string[];
};

const blankForm: FormState = {
  name: '',
  description: '',
  itemType: 'ADDON',
  sku: '',
  price: '',
  currency: 'CAD',
  pricingMode: 'PER_RESERVATION',
  taxable: true,
  active: true,
  required: false,
  recommended: false,
  trackInventory: false,
  stockQuantity: '',
  compatibilityMode: 'ALL',
  categories: [],
  tags: '',
  assetIds: [],
  excludedAssetIds: [],
};

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,.06)',
};
const input: CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8,
  padding: '10px 12px', fontSize: 14, background: '#fff',
};
const primary: CSSProperties = {
  border: 0, borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600,
  cursor: 'pointer', background: '#116dff', color: '#fff',
};
const secondary: CSSProperties = {
  ...primary, border: '1px solid #116dff', background: '#fff', color: '#116dff',
};

function toCents(value: string): number {
  const amount = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(amount) || amount < 0) throw new Error('INVALID_PRICE');
  return Math.round(amount * 100);
}

function parseTags(value: string): string[] {
  return [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))];
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

const CatalogPage: FC = () => {
  const { t, locale } = useRentalFlowI18n('dashboard');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState<'ALL' | CatalogItemType>('ALL');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [catalogResult, assetResult] = await Promise.all([
        items.query(CATALOG).limit(1000).find(),
        items.query(ASSETS).limit(1000).find(),
      ]);
      setCatalog(catalogResult.items as CatalogItem[]);
      setAssets((assetResult.items as Asset[]).filter((asset) => asset.active !== false));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Impossible de charger le catalogue.', 'Unable to load the catalog.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const categories = useMemo(() => [...new Set(assets.map((asset) => asset.productType?.trim()).filter((value): value is string => Boolean(value)))].sort(), [assets]);
  const filtered = useMemo(() => filter === 'ALL' ? catalog : catalog.filter((item) => item.itemType === filter), [catalog, filter]);

  const money = (cents = 0, currency = 'CAD') => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);

  const openNew = (itemType: CatalogItemType = 'ADDON') => {
    setEditing(null);
    setForm({ ...blankForm, itemType });
    setFormError('');
    setOpen(true);
  };

  const editItem = (item: CatalogItem) => {
    setEditing(item);
    setForm({
      name: item.name || '',
      description: item.description || '',
      itemType: item.itemType || 'ADDON',
      sku: item.sku || '',
      price: typeof item.priceCents === 'number' ? (item.priceCents / 100).toFixed(2) : '',
      currency: item.currency || 'CAD',
      pricingMode: item.pricingMode || 'PER_RESERVATION',
      taxable: item.taxable !== false,
      active: item.active !== false,
      required: item.required === true,
      recommended: item.recommended === true,
      trackInventory: item.trackInventory === true,
      stockQuantity: typeof item.stockQuantity === 'number' ? String(item.stockQuantity) : '',
      compatibilityMode: item.compatibilityMode || 'ALL',
      categories: decodeCatalogList(item.applicableCategoriesJson),
      tags: decodeCatalogList(item.applicableTagsJson).join(', '),
      assetIds: decodeCatalogList(item.applicableAssetIdsJson),
      excludedAssetIds: decodeCatalogList(item.excludedAssetIdsJson),
    });
    setFormError('');
    setOpen(true);
  };

  const close = () => {
    if (!saving) {
      setOpen(false);
      setEditing(null);
      setFormError('');
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setSuccess('');

    const name = form.name.trim();
    if (!name) return setFormError(t('Le nom est obligatoire.', 'Name is required.'));

    let priceCents = 0;
    try {
      priceCents = toCents(form.price || '0');
    } catch {
      return setFormError(t('Le prix est invalide.', 'The price is invalid.'));
    }

    const stockQuantity = form.trackInventory ? Math.max(0, Math.round(Number(form.stockQuantity || 0))) : 0;
    if (!Number.isFinite(stockQuantity)) return setFormError(t('La quantité en stock est invalide.', 'Stock quantity is invalid.'));
    if (form.compatibilityMode === 'CATEGORIES' && form.categories.length === 0) return setFormError(t('Choisissez au moins une catégorie compatible.', 'Choose at least one compatible category.'));
    if (form.compatibilityMode === 'TAGS' && parseTags(form.tags).length === 0) return setFormError(t('Ajoutez au moins un tag compatible.', 'Add at least one compatible tag.'));
    if (form.compatibilityMode === 'ASSETS' && form.assetIds.length === 0) return setFormError(t('Choisissez au moins un équipement compatible.', 'Choose at least one compatible asset.'));

    const payload: CatalogItem = {
      name,
      description: form.description.trim(),
      itemType: form.itemType,
      sku: form.sku.trim().toUpperCase(),
      priceCents,
      currency: form.currency,
      pricingMode: form.pricingMode,
      taxable: form.taxable,
      active: form.active,
      required: form.required,
      recommended: form.recommended,
      trackInventory: form.trackInventory,
      stockQuantity,
      compatibilityMode: form.compatibilityMode,
      applicableCategoriesJson: encodeCatalogList(form.compatibilityMode === 'CATEGORIES' ? form.categories : []),
      applicableTagsJson: encodeCatalogList(form.compatibilityMode === 'TAGS' ? parseTags(form.tags) : []),
      applicableAssetIdsJson: encodeCatalogList(form.compatibilityMode === 'ASSETS' ? form.assetIds : []),
      excludedAssetIdsJson: encodeCatalogList(form.excludedAssetIds),
      image: editing?.image,
    };

    setSaving(true);
    try {
      if (editing?._id) {
        const updated = await items.update(CATALOG, { _id: editing._id, ...payload }) as CatalogItem;
        setCatalog((current) => current.map((item) => item._id === editing._id ? updated : item));
        setSuccess(t(`${name} a été modifié.`, `${name} was updated.`));
      } else {
        const created = await items.insert(CATALOG, payload) as CatalogItem;
        setCatalog((current) => [...current, created]);
        setSuccess(t(`${name} a été ajouté.`, `${name} was added.`));
      }
      setOpen(false);
      setEditing(null);
      setForm(blankForm);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t('Erreur pendant l’enregistrement.', 'Error while saving.'));
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = (type?: CatalogItemType) => {
    if (type === 'PRODUCT') return t('Produit', 'Product');
    if (type === 'SERVICE') return t('Service', 'Service');
    return t('Extra', 'Add-on');
  };

  const pricingLabel = (mode?: PricingMode) => {
    if (mode === 'PER_UNIT') return t('par unité', 'per unit');
    if (mode === 'PER_DAY') return t('par jour', 'per day');
    if (mode === 'PER_RESERVATION') return t('par réservation', 'per reservation');
    return t('fixe', 'fixed');
  };

  const compatibilitySummary = (item: CatalogItem) => {
    if ((item.compatibilityMode || 'ALL') === 'ALL') return t('Tous les équipements', 'All equipment');
    if (item.compatibilityMode === 'CATEGORIES') return decodeCatalogList(item.applicableCategoriesJson).join(', ') || '—';
    if (item.compatibilityMode === 'TAGS') return decodeCatalogList(item.applicableTagsJson).map((tag) => `#${tag}`).join(', ') || '—';
    const count = decodeCatalogList(item.applicableAssetIdsJson).length;
    return t(`${count} équipement(s)`, `${count} asset(s)`);
  };

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header
          title={t('Catalogue', 'Catalog')}
          subtitle={t('Produits, accessoires, services et extras proposés avec vos locations.', 'Products, accessories, services and add-ons offered with your rentals.')}
        />
        <Page.Content>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ color: '#64748b' }}>
                {t('Créez un extra une seule fois puis appliquez-le à plusieurs équipements grâce aux règles de compatibilité.', 'Create an add-on once, then apply it to multiple assets using compatibility rules.')}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button style={secondary} onClick={() => openNew('PRODUCT')}>+ {t('Produit', 'Product')}</button>
                <button style={primary} onClick={() => openNew('ADDON')}>+ {t('Extra', 'Add-on')}</button>
              </div>
            </div>

            {success && <div style={{ ...card, background: '#f0fdf4', borderColor: '#86efac', color: '#166534' }}>{success}</div>}
            {error && <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>{error}</div>}

            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <strong>{t('Afficher :', 'Show:')}</strong>
              <select style={{ ...input, width: 220 }} value={filter} onChange={(e) => setFilter(e.target.value as 'ALL' | CatalogItemType)}>
                <option value="ALL">{t('Tout le catalogue', 'Entire catalog')}</option>
                <option value="PRODUCT">{t('Produits', 'Products')}</option>
                <option value="ADDON">{t('Extras', 'Add-ons')}</option>
                <option value="SERVICE">{t('Services', 'Services')}</option>
              </select>
              <span style={{ color: '#64748b' }}>{filtered.length} {t('élément(s)', 'item(s)')}</span>
            </div>

            <div style={card}>
              {loading ? <div>{t('Chargement…', 'Loading…')}</div> : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: 42 }}>
                  {t('Votre catalogue est vide. Ajoutez votre premier produit ou extra.', 'Your catalog is empty. Add your first product or add-on.')}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#64748b' }}>
                        <th style={{ padding: 10 }}>{t('Élément', 'Item')}</th>
                        <th>{t('Type', 'Type')}</th>
                        <th>{t('Prix', 'Price')}</th>
                        <th>{t('Compatibilité', 'Compatibility')}</th>
                        <th>{t('État', 'Status')}</th>
                        <th style={{ textAlign: 'right' }}>{t('Actions', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((item, index) => (
                        <tr key={item._id || `${item.name}-${index}`} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: 12 }}>
                            <div style={{ fontWeight: 700 }}>{item.name || t('Sans nom', 'Unnamed')}</div>
                            <div style={{ color: '#64748b', fontSize: 12 }}>{item.sku || item.description || '—'}</div>
                          </td>
                          <td>{typeLabel(item.itemType)}</td>
                          <td>{money(item.priceCents, item.currency)} <span style={{ color: '#64748b', fontSize: 12 }}>{pricingLabel(item.pricingMode)}</span></td>
                          <td>
                            <div>{compatibilitySummary(item)}</div>
                            {decodeCatalogList(item.excludedAssetIdsJson).length > 0 && <div style={{ color: '#b45309', fontSize: 12 }}>{t('Avec exclusions', 'With exclusions')}</div>}
                          </td>
                          <td>
                            <span style={{ color: item.active === false ? '#b91c1c' : '#166534', fontWeight: 600 }}>{item.active === false ? t('Inactif', 'Inactive') : t('Actif', 'Active')}</span>
                            {item.required && <div style={{ fontSize: 12 }}>{t('Obligatoire', 'Required')}</div>}
                            {!item.required && item.recommended && <div style={{ fontSize: 12 }}>{t('Recommandé', 'Recommended')}</div>}
                          </td>
                          <td style={{ textAlign: 'right' }}><button style={{ ...secondary, padding: '7px 11px' }} onClick={() => editItem(item)}>{t('Modifier', 'Edit')}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Page.Content>
      </Page>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <form onSubmit={save} style={{ width: 'min(980px, 100%)', maxHeight: '92vh', overflow: 'auto', background: '#fff', borderRadius: 14, boxShadow: '0 24px 70px rgba(0,0,0,.25)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ margin: 0 }}>{editing ? t('Modifier un élément', 'Edit catalog item') : t('Nouvel élément du catalogue', 'New catalog item')}</h2>
            </div>
            <div style={{ padding: 24 }}>
              {formError && <div style={{ background: '#fef2f2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 18 }}>{formError}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
                <Field label={t('Nom *', 'Name *')}><input autoFocus style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label={t('Type', 'Type')}><select style={input} value={form.itemType} onChange={(e) => setForm({ ...form, itemType: e.target.value as CatalogItemType })}><option value="PRODUCT">{t('Produit à vendre', 'Product for sale')}</option><option value="ADDON">{t('Extra de location', 'Rental add-on')}</option><option value="SERVICE">{t('Service', 'Service')}</option></select></Field>
                <Field label="SKU"><input style={input} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
                <Field label={t('Prix', 'Price')}><input style={input} inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="25.00" /></Field>
                <Field label={t('Devise', 'Currency')}><select style={input} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option>CAD</option><option>USD</option><option>EUR</option></select></Field>
                <Field label={t('Tarification', 'Pricing')}><select style={input} value={form.pricingMode} onChange={(e) => setForm({ ...form, pricingMode: e.target.value as PricingMode })}><option value="FIXED">{t('Prix fixe', 'Fixed price')}</option><option value="PER_UNIT">{t('Par unité', 'Per unit')}</option><option value="PER_DAY">{t('Par jour', 'Per day')}</option><option value="PER_RESERVATION">{t('Par réservation', 'Per reservation')}</option></select></Field>
              </div>

              <div style={{ marginTop: 16 }}><Field label={t('Description', 'Description')}><textarea style={{ ...input, minHeight: 84, resize: 'vertical' }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>

              <h3 style={{ marginTop: 26 }}>{t('Options', 'Options')}</h3>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <Check checked={form.active} onChange={(checked) => setForm({ ...form, active: checked })} label={t('Actif', 'Active')} />
                <Check checked={form.taxable} onChange={(checked) => setForm({ ...form, taxable: checked })} label={t('Taxable', 'Taxable')} />
                <Check checked={form.recommended} onChange={(checked) => setForm({ ...form, recommended: checked, required: checked ? false : form.required })} label={t('Recommandé', 'Recommended')} />
                <Check checked={form.required} onChange={(checked) => setForm({ ...form, required: checked, recommended: checked ? false : form.recommended })} label={t('Obligatoire', 'Required')} />
                <Check checked={form.trackInventory} onChange={(checked) => setForm({ ...form, trackInventory: checked })} label={t('Suivre l’inventaire', 'Track inventory')} />
              </div>
              {form.trackInventory && <div style={{ marginTop: 14, maxWidth: 240 }}><Field label={t('Quantité en stock', 'Stock quantity')}><input style={input} inputMode="numeric" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} /></Field></div>}

              <h3 style={{ marginTop: 28, marginBottom: 6 }}>{t('Compatibilité', 'Compatibility')}</h3>
              <div style={{ color: '#64748b', fontSize: 13, marginBottom: 14 }}>{t('Un seul extra peut être appliqué automatiquement à plusieurs équipements.', 'A single add-on can automatically apply to multiple assets.')}</div>
              <Field label={t('Appliquer à', 'Apply to')}>
                <select style={input} value={form.compatibilityMode} onChange={(e) => setForm({ ...form, compatibilityMode: e.target.value as CatalogCompatibilityMode })}>
                  <option value="ALL">{t('Tous les équipements', 'All equipment')}</option>
                  <option value="CATEGORIES">{t('Certaines catégories', 'Selected categories')}</option>
                  <option value="TAGS">{t('Certains tags', 'Selected tags')}</option>
                  <option value="ASSETS">{t('Équipements sélectionnés', 'Selected assets')}</option>
                </select>
              </Field>

              {form.compatibilityMode === 'CATEGORIES' && (
                <ChoiceGrid title={t('Catégories compatibles', 'Compatible categories')} empty={categories.length === 0 ? t('Aucune catégorie trouvée dans vos équipements.', 'No categories found in your equipment.') : ''}>
                  {categories.map((category) => <Check key={category} checked={form.categories.includes(category)} onChange={() => setForm({ ...form, categories: toggleValue(form.categories, category) })} label={category} />)}
                </ChoiceGrid>
              )}

              {form.compatibilityMode === 'TAGS' && (
                <div style={{ marginTop: 16 }}><Field label={t('Tags compatibles, séparés par des virgules', 'Compatible tags, separated by commas')}><input style={input} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder={t('camping, livrable, attelage-2-po', 'camping, deliverable, hitch-2-in')} /></Field></div>
              )}

              {form.compatibilityMode === 'ASSETS' && (
                <ChoiceGrid title={t('Équipements compatibles', 'Compatible assets')} empty={assets.length === 0 ? t('Aucun équipement actif.', 'No active equipment.') : ''}>
                  {assets.map((asset) => asset._id ? <Check key={asset._id} checked={form.assetIds.includes(asset._id)} onChange={() => setForm({ ...form, assetIds: toggleValue(form.assetIds, asset._id!) })} label={`${asset.title || asset.assetNumber || t('Équipement', 'Asset')} ${asset.productType ? `· ${asset.productType}` : ''}`} /> : null)}
                </ChoiceGrid>
              )}

              {form.compatibilityMode !== 'ASSETS' && assets.length > 0 && (
                <ChoiceGrid title={t('Exclure certains équipements (facultatif)', 'Exclude specific assets (optional)')}>
                  {assets.map((asset) => asset._id ? <Check key={asset._id} checked={form.excludedAssetIds.includes(asset._id)} onChange={() => setForm({ ...form, excludedAssetIds: toggleValue(form.excludedAssetIds, asset._id!) })} label={asset.title || asset.assetNumber || t('Équipement', 'Asset')} /> : null)}
                </ChoiceGrid>
              )}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" style={secondary} onClick={close} disabled={saving}>{t('Annuler', 'Cancel')}</button>
              <button type="submit" style={primary} disabled={saving}>{saving ? t('Enregistrement…', 'Saving…') : t('Enregistrer', 'Save')}</button>
            </div>
          </form>
        </div>
      )}
    </WixDesignSystemProvider>
  );
};

const Field: FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label style={{ display: 'block' }}><span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</span>{children}</label>;
const Check: FC<{ checked: boolean; onChange: (checked: boolean) => void; label: string }> = ({ checked, onChange, label }) => <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>;
const ChoiceGrid: FC<{ title: string; empty?: string; children?: React.ReactNode }> = ({ title, empty, children }) => <div style={{ ...card, padding: 16, marginTop: 16, background: '#f8fafc' }}><div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>{empty ? <div style={{ color: '#64748b', fontSize: 13 }}>{empty}</div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>{children}</div>}</div>;

export default CatalogPage;
