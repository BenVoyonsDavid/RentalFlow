import type { CSSProperties, FC, FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { items } from '@wix/data';
import { Page, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import { assetLimitForPlan, canCreateAsset, hasFeature, planLabels, requiredPlan } from '../../../../lib/plans';
import { useRentalFlowPlan } from '../../../../lib/use-plan';

const COLLECTION = '@pilotedavid1/rental-flow/assets';

type AssetStatus = 'AVAILABLE' | 'RESERVED' | 'RENTED' | 'MAINTENANCE' | 'INACTIVE';

type Asset = {
  _id?: string;
  title?: string;
  assetNumber?: string;
  productType?: string;
  status?: AssetStatus;
  dailyRateCents?: number;
  weeklyRateCents?: number;
  monthlyRateCents?: number;
  discountAfterDays?: number;
  discountPercent?: number;
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
  status: AssetStatus;
  dailyRate: string;
  weeklyRate: string;
  monthlyRate: string;
  discountAfterDays: string;
  discountPercent: string;
  currency: string;
  serialNumber: string;
  notes: string;
};

const blankForm: AssetForm = {
  title: '', assetNumber: '', productType: '', status: 'AVAILABLE', dailyRate: '', weeklyRate: '', monthlyRate: '',
  discountAfterDays: '', discountPercent: '', currency: 'CAD', serialNumber: '', notes: '',
};

const statusLabels: Record<AssetStatus, string> = {
  AVAILABLE: 'Disponible', RESERVED: 'Réservé', RENTED: 'En location', MAINTENANCE: 'Entretien', INACTIVE: 'Inactif',
};

const card: CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.06)' };
const primary: CSSProperties = { border: 0, borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', background: '#116dff', color: '#fff' };
const secondary: CSSProperties = { ...primary, border: '1px solid #116dff', background: '#fff', color: '#116dff' };
const danger: CSSProperties = { ...secondary, borderColor: '#dc2626', color: '#b91c1c' };
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px', fontSize: 14, background: '#fff' };

function toCents(value: string): number {
  const amount = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Le tarif doit être un montant valide.');
  return Math.round(amount * 100);
}
function optionalNumber(value: string): number {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return 0;
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) throw new Error('Une valeur de tarification est invalide.');
  return number;
}
function money(cents?: number, currency = 'CAD'): string {
  if (!cents) return '—';
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency }).format(cents / 100);
}
function rateToInput(cents?: number): string {
  return typeof cents === 'number' && cents > 0 ? (cents / 100).toFixed(2).replace('.', ',') : '';
}

const EquipmentPage: FC = () => {
  const { plan, loading: planLoading } = useRentalFlowPlan();
  const weeklyEnabled = hasFeature(plan, 'WEEKLY_PRICING');
  const monthlyEnabled = hasFeature(plan, 'MONTHLY_PRICING');
  const discountEnabled = hasFeature(plan, 'LONG_TERM_DISCOUNT');
  const assetLimit = assetLimitForPlan(plan);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState<'ALL' | AssetStatus>('ALL');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState<AssetForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadAssets = async () => {
    setLoading(true); setError('');
    try {
      const result = await items.query(COLLECTION).limit(1000).find();
      setAssets(result.items as Asset[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les équipements.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadAssets(); }, []);

  const activeAssetCount = useMemo(() => assets.filter((asset) => asset.active !== false && asset.status !== 'INACTIVE').length, [assets]);
  const filteredAssets = useMemo(() => filter === 'ALL' ? assets : assets.filter((asset) => asset.status === filter), [assets, filter]);
  const assetLimitReached = !planLoading && !canCreateAsset(plan, activeAssetCount);

  const addAsset = () => {
    setError('');
    if (planLoading) return setError('Vérification de votre forfait Wix en cours. Réessayez dans un instant.');
    if (assetLimitReached) {
      return setError(`Votre plan ${planLabels[plan]} permet jusqu’à ${assetLimit} équipements actifs. Passez à un plan supérieur pour en ajouter.`);
    }
    setEditing(null); setForm(blankForm); setFormError(''); setOpen(true);
  };

  const editAsset = (asset: Asset) => {
    if (!asset._id) return setError('Identifiant Wix manquant pour cet équipement.');
    setEditing(asset);
    setForm({
      title: asset.title ?? '', assetNumber: asset.assetNumber ?? '', productType: asset.productType ?? '', status: asset.status ?? 'AVAILABLE',
      dailyRate: rateToInput(asset.dailyRateCents), weeklyRate: rateToInput(asset.weeklyRateCents), monthlyRate: rateToInput(asset.monthlyRateCents),
      discountAfterDays: asset.discountAfterDays ? String(asset.discountAfterDays) : '', discountPercent: asset.discountPercent ? String(asset.discountPercent).replace('.', ',') : '',
      currency: asset.currency ?? 'CAD', serialNumber: asset.serialNumber ?? '', notes: asset.notes ?? '',
    });
    setFormError(''); setOpen(true);
  };

  const close = () => {
    if (!saving) { setOpen(false); setEditing(null); setFormError(''); }
  };

  const saveAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(''); setSuccess('');
    const title = form.title.trim();
    const assetNumber = form.assetNumber.trim().toUpperCase();
    if (!title) return setFormError('Le nom de l’équipement est obligatoire.');
    if (!assetNumber) return setFormError('Le numéro d’actif est obligatoire.');

    if (!editing && !canCreateAsset(plan, activeAssetCount)) {
      return setFormError(`Limite atteinte : le plan ${planLabels[plan]} permet ${assetLimit} équipements actifs.`);
    }

    const reactivating = editing?.active === false && form.status !== 'INACTIVE';
    if (reactivating && !canCreateAsset(plan, activeAssetCount)) {
      return setFormError(`Impossible de réactiver cet équipement : le plan ${planLabels[plan]} permet ${assetLimit} équipements actifs.`);
    }

    setSaving(true);
    try {
      const matches = await items.query(COLLECTION).eq('assetNumber', assetNumber).limit(5).find();
      const conflict = (matches.items as Asset[]).some((asset) => asset._id !== editing?._id);
      if (conflict) return setFormError(`Le numéro d’actif ${assetNumber} existe déjà.`);

      const payload: Asset = {
        title, assetNumber, productType: form.productType.trim(), status: form.status,
        dailyRateCents: form.dailyRate.trim() ? toCents(form.dailyRate) : 0,
        weeklyRateCents: weeklyEnabled && form.weeklyRate.trim() ? toCents(form.weeklyRate) : 0,
        monthlyRateCents: monthlyEnabled && form.monthlyRate.trim() ? toCents(form.monthlyRate) : 0,
        discountAfterDays: discountEnabled ? Math.round(optionalNumber(form.discountAfterDays)) : 0,
        discountPercent: discountEnabled ? optionalNumber(form.discountPercent) : 0,
        currency: form.currency, serialNumber: form.serialNumber.trim(), notes: form.notes.trim(), active: form.status !== 'INACTIVE',
      };
      if ((payload.discountPercent ?? 0) > 100) throw new Error('Le rabais ne peut pas dépasser 100 %.');

      if (editing?._id) {
        const updated = await items.update(COLLECTION, { _id: editing._id, ...payload, image: editing.image }) as Asset;
        setAssets((current) => current.map((asset) => asset._id === editing._id ? updated : asset));
        setSuccess(`${title} a été modifié.`);
      } else {
        const created = await items.insert(COLLECTION, payload) as Asset;
        setAssets((current) => [...current, created]);
        setSuccess(`${title} a été ajouté.`);
      }
      setOpen(false); setEditing(null); setForm(blankForm);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erreur pendant l’enregistrement.');
    } finally { setSaving(false); }
  };

  const deactivate = async (asset: Asset) => {
    if (!asset._id) return;
    if (!window.confirm(`Désactiver ${asset.title ?? asset.assetNumber ?? 'cet équipement'} ? Il restera dans l’historique.`)) return;
    setError(''); setSuccess('');
    try {
      const updated = await items.update(COLLECTION, {
        _id: asset._id, title: asset.title, assetNumber: asset.assetNumber, productType: asset.productType, status: 'INACTIVE',
        dailyRateCents: asset.dailyRateCents ?? 0, weeklyRateCents: asset.weeklyRateCents ?? 0, monthlyRateCents: asset.monthlyRateCents ?? 0,
        discountAfterDays: asset.discountAfterDays ?? 0, discountPercent: asset.discountPercent ?? 0, currency: asset.currency ?? 'CAD',
        serialNumber: asset.serialNumber, image: asset.image, notes: asset.notes, active: false,
      }) as Asset;
      setAssets((current) => current.map((item) => item._id === asset._id ? updated : item));
      setSuccess(`${asset.title ?? 'L’équipement'} a été désactivé.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible de désactiver cet équipement.'); }
  };

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header title="Équipements" subtitle="Inventaire physique, statuts et tarification de chaque unité." />
        <Page.Content>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <strong>Plan : {planLoading ? 'Vérification…' : planLabels[plan]}</strong>
                <div style={{ color: '#64748b', fontSize: 13, marginTop: 3 }}>
                  {assetLimit === null ? `${activeAssetCount} équipements actifs · inventaire illimité` : `${activeAssetCount} / ${assetLimit} équipements actifs`}
                </div>
              </div>
              <button style={{ ...primary, opacity: assetLimitReached ? .55 : 1 }} onClick={addAsset} disabled={planLoading}>+ Ajouter un équipement</button>
            </div>

            {assetLimitReached && <div style={{ ...card, background: '#fff7ed', borderColor: '#fdba74', color: '#9a3412' }}>Limite du plan atteinte. Vous pouvez modifier ou désactiver vos équipements existants, mais un plan supérieur est requis pour en activer davantage.</div>}
            {success && <div style={{ ...card, background: '#f0fdf4', borderColor: '#86efac', color: '#166534' }}>{success}</div>}
            {error && <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>{error}</div>}

            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <strong>Filtrer :</strong>
              <select style={{ ...input, width: 220 }} value={filter} onChange={(e) => setFilter(e.target.value as 'ALL' | AssetStatus)}>
                <option value="ALL">Tous</option><option value="AVAILABLE">Disponibles</option><option value="RESERVED">Réservés</option><option value="RENTED">En location</option><option value="MAINTENANCE">Entretien</option><option value="INACTIVE">Inactifs</option>
              </select>
              <span style={{ color: '#64748b' }}>{filteredAssets.length} résultat(s)</span>
            </div>

            <div style={card}>
              {loading ? <div>Chargement…</div> : filteredAssets.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Aucun équipement dans cette vue.</div> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
                    <thead><tr style={{ textAlign: 'left', color: '#64748b' }}><th style={{ padding: 10 }}>Équipement</th><th>Numéro</th><th>Statut</th><th style={{ textAlign: 'right' }}>Jour</th><th style={{ textAlign: 'right' }}>Semaine</th><th style={{ textAlign: 'right' }}>Mois</th><th>Rabais longue durée</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                    <tbody>{filteredAssets.map((asset, index) => (
                      <tr key={asset._id ?? `${asset.assetNumber}-${index}`} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: 12 }}><div style={{ fontWeight: 700 }}>{asset.title || 'Sans nom'}</div><div style={{ color: '#64748b', fontSize: 12 }}>{asset.productType || 'Type non défini'}</div></td>
                        <td>{asset.assetNumber || '—'}</td><td>{asset.status ? statusLabels[asset.status] : '—'}</td>
                        <td style={{ textAlign: 'right' }}>{money(asset.dailyRateCents, asset.currency)}</td><td style={{ textAlign: 'right' }}>{money(asset.weeklyRateCents, asset.currency)}</td><td style={{ textAlign: 'right' }}>{money(asset.monthlyRateCents, asset.currency)}</td>
                        <td>{asset.discountAfterDays && asset.discountPercent ? `${asset.discountPercent}% après ${asset.discountAfterDays} jours` : '—'}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><button style={{ ...secondary, padding: '7px 11px', marginRight: 8 }} onClick={() => editAsset(asset)}>Modifier</button>{asset.status !== 'INACTIVE' && <button style={{ ...danger, padding: '7px 11px' }} onClick={() => void deactivate(asset)}>Désactiver</button>}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Page.Content>
      </Page>

      {open && (
        <div onMouseDown={close} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 820, maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 14, boxShadow: '0 24px 70px rgba(0,0,0,.25)' }}>
            <form onSubmit={saveAsset}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', gap: 16 }}><div><h2 style={{ margin: 0 }}>{editing ? 'Modifier l’équipement' : 'Ajouter un équipement'}</h2><div style={{ color: '#64748b', marginTop: 4 }}>Identification, statut et tarification de l’unité physique.</div></div><button type="button" onClick={close} disabled={saving} style={{ border: 0, background: 'transparent', fontSize: 26, cursor: 'pointer' }}>×</button></div>
              <div style={{ padding: 24 }}>
                {formError && <div style={{ background: '#fef2f2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 18 }}>{formError}</div>}
                <h3 style={{ marginTop: 0 }}>Informations</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 18 }}>
                  <Field label="Nom de l’équipement *"><input autoFocus style={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex. Kayak Pelican" /></Field>
                  <Field label="Numéro d’actif *"><input style={input} value={form.assetNumber} onChange={(e) => setForm({ ...form, assetNumber: e.target.value })} placeholder="Ex. KAY-001" /></Field>
                  <Field label="Type de produit"><input style={input} value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })} placeholder="Ex. Kayak" /></Field>
                  <Field label="Numéro de série"><input style={input} value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} /></Field>
                  <Field label="Statut"><select style={input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AssetStatus })}><option value="AVAILABLE">Disponible</option><option value="RESERVED">Réservé</option><option value="RENTED">En location</option><option value="MAINTENANCE">Entretien</option><option value="INACTIVE">Inactif</option></select></Field>
                  <Field label="Devise"><select style={input} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option value="CAD">CAD</option><option value="USD">USD</option><option value="EUR">EUR</option></select></Field>
                </div>
                <h3 style={{ marginTop: 26, marginBottom: 6 }}>Tarification</h3><div style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Le moteur de réservation choisira ensuite le tarif applicable selon la durée.</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 18 }}>
                  <Field label="Tarif journalier"><input style={input} inputMode="decimal" value={form.dailyRate} onChange={(e) => setForm({ ...form, dailyRate: e.target.value })} placeholder="49,99" /></Field>
                  <PremiumField enabled={weeklyEnabled} feature="WEEKLY_PRICING"><Field label="Tarif hebdomadaire"><input disabled={!weeklyEnabled} style={{ ...input, opacity: weeklyEnabled ? 1 : .55 }} inputMode="decimal" value={form.weeklyRate} onChange={(e) => setForm({ ...form, weeklyRate: e.target.value })} placeholder="299,99" /></Field></PremiumField>
                  <PremiumField enabled={monthlyEnabled} feature="MONTHLY_PRICING"><Field label="Tarif mensuel"><input disabled={!monthlyEnabled} style={{ ...input, opacity: monthlyEnabled ? 1 : .55 }} inputMode="decimal" value={form.monthlyRate} onChange={(e) => setForm({ ...form, monthlyRate: e.target.value })} placeholder="899,99" /></Field></PremiumField>
                  <PremiumField enabled={discountEnabled} feature="LONG_TERM_DISCOUNT"><Field label="Rabais après X jours"><input disabled={!discountEnabled} style={{ ...input, opacity: discountEnabled ? 1 : .55 }} inputMode="numeric" value={form.discountAfterDays} onChange={(e) => setForm({ ...form, discountAfterDays: e.target.value })} placeholder="Ex. 10" /></Field></PremiumField>
                  <PremiumField enabled={discountEnabled} feature="LONG_TERM_DISCOUNT"><Field label="Rabais longue durée (%)"><input disabled={!discountEnabled} style={{ ...input, opacity: discountEnabled ? 1 : .55 }} inputMode="decimal" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} placeholder="Ex. 15" /></Field></PremiumField>
                </div>
                <div style={{ marginTop: 20 }}><Field label="Notes"><textarea style={{ ...input, minHeight: 100, resize: 'vertical' }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button type="button" style={secondary} onClick={close} disabled={saving}>Annuler</button><button type="submit" style={primary} disabled={saving}>{saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Ajouter'}</button></div>
            </form>
          </div>
        </div>
      )}
    </WixDesignSystemProvider>
  );
};

const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => <label style={{ display: 'block' }}><span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</span>{children}</label>;
const PremiumField: FC<{ enabled: boolean; feature: Parameters<typeof requiredPlan>[0]; children: ReactNode }> = ({ enabled, feature, children }) => <div>{children}{!enabled && <div style={{ marginTop: 6, fontSize: 12, color: '#7c3aed' }}>🔒 Plan {planLabels[requiredPlan(feature)]} requis</div>}</div>;

export default EquipmentPage;
