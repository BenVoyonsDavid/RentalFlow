import type { CSSProperties, FC, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { items } from '@wix/data';
import { Page, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import { useRentalFlowI18n } from '../../../../intl';

const CATEGORIES = '@pilotedavid1/rental-flow/categories';

type Category = {
  _id?: string;
  name?: string;
  key?: string;
  description?: string;
  forEquipment?: boolean;
  forProducts?: boolean;
  forExtras?: boolean;
  active?: boolean;
  sortOrder?: number;
};

type FormState = {
  name: string;
  description: string;
  forEquipment: boolean;
  forProducts: boolean;
  forExtras: boolean;
  active: boolean;
  sortOrder: string;
};

const blankForm: FormState = {
  name: '', description: '', forEquipment: true, forProducts: true, forExtras: true, active: true, sortOrder: '0',
};

const card: CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.06)' };
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px', fontSize: 14, background: '#fff' };
const primary: CSSProperties = { border: 0, borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', background: '#116dff', color: '#fff' };
const secondary: CSSProperties = { ...primary, border: '1px solid #116dff', background: '#fff', color: '#116dff' };

function slugify(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

const CategoriesPage: FC = () => {
  const { t } = useRentalFlowI18n('dashboard');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const result = await items.query(CATEGORIES).limit(1000).find();
      setCategories(result.items as Category[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Impossible de charger les catégories.', 'Unable to load categories.'));
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const sorted = useMemo(() => [...categories].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.name || '').localeCompare(String(b.name || ''))), [categories]);

  const openNew = () => { setEditing(null); setForm(blankForm); setFormError(''); setOpen(true); };
  const edit = (category: Category) => {
    setEditing(category);
    setForm({
      name: category.name || '', description: category.description || '',
      forEquipment: category.forEquipment !== false, forProducts: category.forProducts !== false,
      forExtras: category.forExtras !== false, active: category.active !== false,
      sortOrder: String(category.sortOrder || 0),
    });
    setFormError(''); setOpen(true);
  };
  const close = () => { if (!saving) { setOpen(false); setEditing(null); setFormError(''); } };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(''); setSuccess('');
    const name = form.name.trim();
    if (!name) return setFormError(t('Le nom est obligatoire.', 'Name is required.'));
    if (!form.forEquipment && !form.forProducts && !form.forExtras) return setFormError(t('Choisissez au moins un usage.', 'Choose at least one usage.'));
    const key = editing?.key || slugify(name);
    if (!key) return setFormError(t('Le nom ne permet pas de créer une clé valide.', 'The name cannot generate a valid key.'));
    const sortOrder = Math.max(0, Math.round(Number(form.sortOrder || 0)));
    if (!Number.isFinite(sortOrder)) return setFormError(t('L’ordre est invalide.', 'Sort order is invalid.'));

    setSaving(true);
    try {
      const matches = await items.query(CATEGORIES).eq('key', key).limit(5).find();
      const conflict = (matches.items as Category[]).some((item) => item._id !== editing?._id);
      if (conflict) return setFormError(t('Une catégorie avec ce nom existe déjà.', 'A category with this name already exists.'));
      const payload: Category = {
        name, key, description: form.description.trim(), forEquipment: form.forEquipment,
        forProducts: form.forProducts, forExtras: form.forExtras, active: form.active, sortOrder,
      };
      if (editing?._id) {
        const updated = await items.update(CATEGORIES, { _id: editing._id, ...payload }) as Category;
        setCategories((current) => current.map((item) => item._id === editing._id ? updated : item));
        setSuccess(t(`${name} a été modifiée.`, `${name} was updated.`));
      } else {
        const created = await items.insert(CATEGORIES, payload) as Category;
        setCategories((current) => [...current, created]);
        setSuccess(t(`${name} a été ajoutée.`, `${name} was added.`));
      }
      setOpen(false); setEditing(null); setForm(blankForm);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t('Erreur pendant l’enregistrement.', 'Error while saving.'));
    } finally { setSaving(false); }
  };

  const deactivate = async (category: Category) => {
    if (!category._id) return;
    if (!window.confirm(t(`Désactiver la catégorie ${category.name || ''} ?`, `Deactivate category ${category.name || ''}?`))) return;
    try {
      const updated = await items.update(CATEGORIES, { ...category, _id: category._id, active: false }) as Category;
      setCategories((current) => current.map((item) => item._id === category._id ? updated : item));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Impossible de désactiver la catégorie.', 'Unable to deactivate category.'));
    }
  };

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header title={t('Catégories', 'Categories')} subtitle={t('Créez des catégories réutilisables pour vos équipements, produits et extras.', 'Create reusable categories for equipment, products, and add-ons.')} />
        <Page.Content>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ color: '#64748b' }}>{t('Une catégorie créée ici devient disponible dans les formulaires RentalFlow.', 'A category created here becomes available throughout RentalFlow forms.')}</div>
              <button style={primary} onClick={openNew}>+ {t('Nouvelle catégorie', 'New category')}</button>
            </div>
            {success && <div style={{ ...card, background: '#f0fdf4', borderColor: '#86efac', color: '#166534' }}>{success}</div>}
            {error && <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>{error}</div>}
            <div style={card}>
              {loading ? <div>{t('Chargement…', 'Loading…')}</div> : sorted.length === 0 ? <div style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>{t('Aucune catégorie. Créez votre première catégorie.', 'No categories yet. Create your first category.')}</div> : (
                <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                  <thead><tr style={{ textAlign: 'left', color: '#64748b' }}><th style={{ padding: 10 }}>{t('Catégorie', 'Category')}</th><th>{t('Utilisation', 'Usage')}</th><th>{t('État', 'Status')}</th><th style={{ textAlign: 'right' }}>{t('Actions', 'Actions')}</th></tr></thead>
                  <tbody>{sorted.map((category) => (
                    <tr key={category._id || category.key} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: 12 }}><strong>{category.name || '—'}</strong><div style={{ color: '#64748b', fontSize: 12 }}>{category.description || category.key || '—'}</div></td>
                      <td><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{category.forEquipment !== false && <Badge>{t('Équipements', 'Equipment')}</Badge>}{category.forProducts !== false && <Badge>{t('Produits', 'Products')}</Badge>}{category.forExtras !== false && <Badge>{t('Extras', 'Add-ons')}</Badge>}</div></td>
                      <td><span style={{ fontWeight: 600, color: category.active === false ? '#b91c1c' : '#166534' }}>{category.active === false ? t('Inactif', 'Inactive') : t('Actif', 'Active')}</span></td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><button style={{ ...secondary, padding: '7px 11px', marginRight: 8 }} onClick={() => edit(category)}>{t('Modifier', 'Edit')}</button>{category.active !== false && <button style={{ ...secondary, padding: '7px 11px', borderColor: '#dc2626', color: '#b91c1c' }} onClick={() => void deactivate(category)}>{t('Désactiver', 'Deactivate')}</button>}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
            </div>
          </div>
        </Page.Content>
      </Page>

      {open && <div onMouseDown={close} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <form onSubmit={save} onMouseDown={(e) => e.stopPropagation()} style={{ width: 'min(720px,100%)', background: '#fff', borderRadius: 14, boxShadow: '0 24px 70px rgba(0,0,0,.25)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}><h2 style={{ margin: 0 }}>{editing ? t('Modifier la catégorie', 'Edit category') : t('Nouvelle catégorie', 'New category')}</h2></div>
          <div style={{ padding: 24 }}>
            {formError && <div style={{ background: '#fef2f2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 18 }}>{formError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}><Field label={t('Nom *', 'Name *')}><input autoFocus style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label={t('Ordre', 'Sort order')}><input style={input} inputMode="numeric" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></Field></div>
            <div style={{ marginTop: 16 }}><Field label={t('Description', 'Description')}><textarea style={{ ...input, minHeight: 80, resize: 'vertical' }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
            <h3 style={{ marginTop: 24, marginBottom: 10 }}>{t('Disponible pour', 'Available for')}</h3>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}><Check checked={form.forEquipment} onChange={(v) => setForm({ ...form, forEquipment: v })} label={t('Équipements', 'Equipment')} /><Check checked={form.forProducts} onChange={(v) => setForm({ ...form, forProducts: v })} label={t('Produits', 'Products')} /><Check checked={form.forExtras} onChange={(v) => setForm({ ...form, forExtras: v })} label={t('Extras et services', 'Add-ons and services')} /><Check checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label={t('Actif', 'Active')} /></div>
          </div>
          <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button type="button" style={secondary} onClick={close} disabled={saving}>{t('Annuler', 'Cancel')}</button><button type="submit" style={primary} disabled={saving}>{saving ? t('Enregistrement…', 'Saving…') : t('Enregistrer', 'Save')}</button></div>
        </form>
      </div>}
    </WixDesignSystemProvider>
  );
};

const Field: FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label style={{ display: 'block' }}><span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</span>{children}</label>;
const Check: FC<{ checked: boolean; onChange: (checked: boolean) => void; label: string }> = ({ checked, onChange, label }) => <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>;
const Badge: FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ background: '#eef5ff', color: '#1d4ed8', padding: '4px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{children}</span>;

export default CategoriesPage;
