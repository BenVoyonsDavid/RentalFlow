import type { CSSProperties, FC, FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { items } from '@wix/data';
import { Page, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';

const COLLECTION = '@pilotedavid1/rental-flow/assets';

type AssetStatus = 'AVAILABLE' | 'RESERVED' | 'RENTED' | 'MAINTENANCE' | 'INACTIVE';

type Asset = {
  _id?: string;
  title?: string;
  assetNumber?: string;
  productType?: string;
  status?: AssetStatus;
  dailyRateCents?: number;
  currency?: string;
  serialNumber?: string;
  image?: unknown;
  notes?: string;
  active?: boolean;
};

type AssetForm = {
  title: string;
  assetNumber: string;
  productType: string;
  dailyRate: string;
  currency: string;
  serialNumber: string;
  status: AssetStatus;
  notes: string;
};

const blankForm: AssetForm = {
  title: '', assetNumber: '', productType: '', dailyRate: '', currency: 'CAD',
  serialNumber: '', status: 'AVAILABLE', notes: '',
};

const labels: Record<AssetStatus, string> = {
  AVAILABLE: 'Disponible', RESERVED: 'Réservé', RENTED: 'En location',
  MAINTENANCE: 'Entretien', INACTIVE: 'Inactif',
};

const card: CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
  padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.06)',
};
const primary: CSSProperties = {
  border: 0, borderRadius: 8, padding: '11px 18px', fontSize: 14,
  fontWeight: 600, cursor: 'pointer', background: '#116dff', color: '#fff',
};
const secondary: CSSProperties = {
  ...primary, border: '1px solid #116dff', padding: '10px 18px',
  background: '#fff', color: '#116dff',
};
const input: CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1',
  borderRadius: 8, padding: '10px 12px', fontSize: 14, background: '#fff',
};

function toCents(value: string): number {
  const amount = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Le tarif journalier doit être valide.');
  return Math.round(amount * 100);
}

function money(cents = 0, currency = 'CAD'): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency }).format(cents / 100);
}

const DashboardPage: FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState<AssetForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadAssets = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await items.query(COLLECTION).limit(100).find();
      setAssets(result.items as Asset[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les équipements.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadAssets(); }, [loadAssets]);

  const counts = useMemo(() => {
    const active = assets.filter((a) => a.active !== false);
    return {
      available: active.filter((a) => a.status === 'AVAILABLE').length,
      reserved: active.filter((a) => a.status === 'RESERVED').length,
      rented: active.filter((a) => a.status === 'RENTED').length,
      maintenance: active.filter((a) => a.status === 'MAINTENANCE').length,
    };
  }, [assets]);

  const add = () => {
    setEditing(null); setForm(blankForm); setFormError(''); setOpen(true);
  };

  const edit = (asset: Asset) => {
    if (!asset._id) return setError('Identifiant Wix manquant pour cet équipement.');
    setEditing(asset);
    setForm({
      title: asset.title ?? '', assetNumber: asset.assetNumber ?? '', productType: asset.productType ?? '',
      dailyRate: typeof asset.dailyRateCents === 'number' ? (asset.dailyRateCents / 100).toFixed(2).replace('.', ',') : '',
      currency: asset.currency ?? 'CAD', serialNumber: asset.serialNumber ?? '',
      status: asset.status ?? 'AVAILABLE', notes: asset.notes ?? '',
    });
    setFormError(''); setOpen(true);
  };

  const close = () => {
    if (!saving) { setOpen(false); setEditing(null); setFormError(''); }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(''); setSuccess('');
    const title = form.title.trim();
    const assetNumber = form.assetNumber.trim().toUpperCase();
    if (!title) return setFormError('Le nom de l’équipement est obligatoire.');
    if (!assetNumber) return setFormError('Le numéro d’actif est obligatoire.');

    setSaving(true);
    try {
      const matches = await items.query(COLLECTION).eq('assetNumber', assetNumber).limit(5).find();
      const conflict = (matches.items as Asset[]).some((a) => a._id !== editing?._id);
      if (conflict) return setFormError(`Le numéro d’actif ${assetNumber} existe déjà.`);

      const data: Asset = {
        title, assetNumber, productType: form.productType.trim(), status: form.status,
        dailyRateCents: form.dailyRate.trim() ? toCents(form.dailyRate) : 0,
        currency: form.currency, serialNumber: form.serialNumber.trim(), notes: form.notes.trim(),
        active: form.status !== 'INACTIVE',
      };

      if (editing?._id) {
        const updated = await items.update(COLLECTION, { _id: editing._id, ...data, image: editing.image }) as Asset;
        setAssets((all) => all.map((a) => a._id === editing._id ? updated : a));
        setSuccess(`${title} a été modifié.`);
      } else {
        const created = await items.insert(COLLECTION, data) as Asset;
        setAssets((all) => [...all, created]);
        setSuccess(`${title} a été ajouté.`);
      }
      setOpen(false); setEditing(null); setForm(blankForm);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erreur pendant l’enregistrement.');
    } finally { setSaving(false); }
  };

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header title="RentalFlow" subtitle="Gérez vos locations, équipements, retours et entretiens au même endroit." />
        <Page.Content>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div><h2 style={{ margin: 0 }}>Aujourd'hui</h2><div style={{ color: '#6b7280', marginTop: 4 }}>Vue d'ensemble de vos opérations de location</div></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={secondary} onClick={add}>+ Ajouter un équipement</button>
                <button style={primary} onClick={() => window.alert('La création de location sera notre prochain module.')}>+ Nouvelle location</button>
              </div>
            </div>

            {success && <div style={{ ...card, background: '#f0fdf4', borderColor: '#86efac', color: '#166534' }}>{success}</div>}
            {error && <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>
              <Stat label="Départs aujourd'hui" value={0} loading={loading} />
              <Stat label="Retours aujourd'hui" value={0} loading={loading} />
              <Stat label="En location" value={counts.rented} loading={loading} />
              <Stat label="Retards" value={0} loading={loading} />
            </div>

            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div><h2 style={{ margin: 0 }}>Inventaire</h2><div style={{ color: '#6b7280', marginTop: 4 }}>{assets.length} équipement(s)</div></div>
                <button style={secondary} onClick={add}>+ Ajouter</button>
              </div>

              {loading ? <div>Chargement…</div> : assets.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', background: '#f8fafc', borderRadius: 10 }}>
                  <strong>Aucun équipement pour le moment</strong><br /><br />
                  <button style={primary} onClick={add}>Ajouter un équipement</button>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
                    <thead><tr style={{ textAlign: 'left', color: '#6b7280' }}>
                      <th style={{ padding: 10 }}>Actif</th><th>Numéro</th><th>Type</th><th>Statut</th>
                      <th style={{ textAlign: 'right' }}>Tarif / jour</th><th style={{ textAlign: 'right' }}>Actions</th>
                    </tr></thead>
                    <tbody>{assets.map((asset, i) => (
                      <tr key={asset._id ?? `${asset.assetNumber}-${i}`} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: 12, fontWeight: 600 }}>{asset.title || 'Sans nom'}</td>
                        <td>{asset.assetNumber || '—'}</td><td>{asset.productType || '—'}</td>
                        <td>{asset.status ? labels[asset.status] : 'Non défini'}</td>
                        <td style={{ textAlign: 'right' }}>{money(asset.dailyRateCents, asset.currency || 'CAD')}</td>
                        <td style={{ textAlign: 'right' }}><button style={{ ...secondary, padding: '7px 12px' }} onClick={() => edit(asset)}>Modifier</button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={card}>
              <h2 style={{ marginTop: 0 }}>État de l'inventaire</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 16 }}>
                <Inventory label="Disponible" value={counts.available} /><Inventory label="Réservé" value={counts.reserved} />
                <Inventory label="En location" value={counts.rented} /><Inventory label="Entretien" value={counts.maintenance} />
              </div>
            </div>
          </div>
        </Page.Content>
      </Page>

      {open && (
        <div onMouseDown={close} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 14 }}>
            <form onSubmit={save}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
                <div><h2 style={{ margin: 0 }}>{editing ? 'Modifier l’équipement' : 'Ajouter un équipement'}</h2><div style={{ color: '#6b7280', marginTop: 4 }}>{editing ? `Modification de ${editing.assetNumber}` : 'Créez une unité physique pouvant être louée.'}</div></div>
                <button type="button" onClick={close} disabled={saving} style={{ border: 0, background: 'transparent', fontSize: 26 }}>×</button>
              </div>

              <div style={{ padding: 24 }}>
                {formError && <div style={{ background: '#fef2f2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 18 }}>{formError}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 18 }}>
                  <Field label="Nom de l’équipement *"><input autoFocus style={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
                  <Field label="Numéro d’actif *"><input style={input} value={form.assetNumber} onChange={(e) => setForm({ ...form, assetNumber: e.target.value })} /></Field>
                  <Field label="Type de produit"><input style={input} value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })} /></Field>
                  <Field label="Numéro de série"><input style={input} value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} /></Field>
                  <Field label="Tarif journalier"><input style={input} inputMode="decimal" value={form.dailyRate} onChange={(e) => setForm({ ...form, dailyRate: e.target.value })} placeholder="49,99" /></Field>
                  <Field label="Devise"><select style={input} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option value="CAD">CAD</option><option value="USD">USD</option><option value="EUR">EUR</option></select></Field>
                  <Field label="Statut"><select style={input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AssetStatus })}><option value="AVAILABLE">Disponible</option><option value="RESERVED">Réservé</option><option value="RENTED">En location</option><option value="MAINTENANCE">Entretien</option><option value="INACTIVE">Inactif</option></select></Field>
                </div>
                <div style={{ marginTop: 18 }}><Field label="Notes"><textarea style={{ ...input, minHeight: 100 }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
              </div>

              <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" style={secondary} onClick={close} disabled={saving}>Annuler</button>
                <button type="submit" style={primary} disabled={saving}>{saving ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Ajouter l’équipement'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </WixDesignSystemProvider>
  );
};

const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <label style={{ display: 'block' }}><span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</span>{children}</label>
);

const Stat: FC<{ label: string; value: number; loading: boolean }> = ({ label, value, loading }) => (
  <div style={card}><div style={{ color: '#6b7280', fontSize: 14 }}>{label}</div><div style={{ fontSize: 32, fontWeight: 700, marginTop: 8 }}>{loading ? '…' : value}</div></div>
);

const Inventory: FC<{ label: string; value: number }> = ({ label, value }) => (
  <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16 }}><div style={{ color: '#6b7280', fontSize: 13 }}>{label}</div><div style={{ fontSize: 24, fontWeight: 700, marginTop: 5 }}>{value}</div></div>
);

export default DashboardPage;
