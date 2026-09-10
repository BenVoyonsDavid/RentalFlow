import type { CSSProperties, FC, FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { items } from '@wix/data';
import { Page, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';

const ASSETS_COLLECTION_ID = '@pilotedavid1/rental-flow/assets';

type AssetStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'RENTED'
  | 'MAINTENANCE'
  | 'INACTIVE';

interface Asset {
  _id?: string;
  title?: string;
  assetNumber?: string;
  productType?: string;
  status?: AssetStatus;
  dailyRateCents?: number;
  currency?: string;
  serialNumber?: string;
  notes?: string;
  active?: boolean;
}

interface AssetFormState {
  title: string;
  assetNumber: string;
  productType: string;
  dailyRate: string;
  currency: string;
  serialNumber: string;
  status: AssetStatus;
  notes: string;
}

const emptyForm: AssetFormState = {
  title: '',
  assetNumber: '',
  productType: '',
  dailyRate: '',
  currency: 'CAD',
  serialNumber: '',
  status: 'AVAILABLE',
  notes: '',
};

const statusLabels: Record<AssetStatus, string> = {
  AVAILABLE: 'Disponible',
  RESERVED: 'Réservé',
  RENTED: 'En location',
  MAINTENANCE: 'Entretien',
  INACTIVE: 'Inactif',
};

const cardStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '20px',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  margin: 0,
};

const primaryButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: '8px',
  padding: '11px 18px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  background: '#116dff',
  color: '#ffffff',
};

const secondaryButtonStyle: CSSProperties = {
  border: '1px solid #116dff',
  borderRadius: '8px',
  padding: '10px 18px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  background: '#ffffff',
  color: '#116dff',
};

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '14px',
  background: '#ffffff',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  marginBottom: '6px',
};

function moneyToCents(value: string): number {
  const normalized = value.trim().replace(',', '.');
  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Le tarif journalier doit être un montant valide.');
  }

  return Math.round(amount * 100);
}

function formatMoney(cents = 0, currency = 'CAD'): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

const DashboardPage: FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AssetFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const result = await items.query(ASSETS_COLLECTION_ID).limit(100).find();
      setAssets(result.items as Asset[]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Impossible de charger les équipements.';
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const counts = useMemo(() => {
    const activeAssets = assets.filter((asset) => asset.active !== false);

    return {
      available: activeAssets.filter((asset) => asset.status === 'AVAILABLE').length,
      reserved: activeAssets.filter((asset) => asset.status === 'RESERVED').length,
      rented: activeAssets.filter((asset) => asset.status === 'RENTED').length,
      maintenance: activeAssets.filter(
        (asset) => asset.status === 'MAINTENANCE'
      ).length,
    };
  }, [assets]);

  const openAssetForm = () => {
    setForm(emptyForm);
    setFormError('');
    setFormOpen(true);
  };

  const closeAssetForm = () => {
    if (!saving) {
      setFormOpen(false);
      setFormError('');
    }
  };

  const saveAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const title = form.title.trim();
    const assetNumber = form.assetNumber.trim().toUpperCase();

    if (!title) {
      setFormError('Le nom de l’équipement est obligatoire.');
      return;
    }

    if (!assetNumber) {
      setFormError('Le numéro d’actif est obligatoire.');
      return;
    }

    setSaving(true);

    try {
      const duplicate = await items
        .query(ASSETS_COLLECTION_ID)
        .eq('assetNumber', assetNumber)
        .limit(1)
        .find();

      if (duplicate.items.length > 0) {
        setFormError(`Le numéro d’actif ${assetNumber} existe déjà.`);
        return;
      }

      const dailyRateCents = form.dailyRate.trim()
        ? moneyToCents(form.dailyRate)
        : 0;

      await items.insert(ASSETS_COLLECTION_ID, {
        title,
        assetNumber,
        productType: form.productType.trim(),
        status: form.status,
        dailyRateCents,
        currency: form.currency,
        serialNumber: form.serialNumber.trim(),
        notes: form.notes.trim(),
        active: form.status !== 'INACTIVE',
      });

      setForm(emptyForm);
      setFormOpen(false);
      await loadAssets();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Une erreur est survenue pendant l’enregistrement.';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const dashboardStats = [
    { label: "Départs aujourd'hui", value: 0 },
    { label: "Retours aujourd'hui", value: 0 },
    { label: 'En location', value: counts.rented },
    { label: 'Retards', value: 0 },
  ];

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header
          title="RentalFlow"
          subtitle="Gérez vos locations, équipements, retours et entretiens au même endroit."
        />

        <Page.Content>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              paddingBottom: '40px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h2 style={sectionTitleStyle}>Aujourd'hui</h2>
                <div
                  style={{
                    marginTop: '5px',
                    color: '#6b7280',
                    fontSize: '14px',
                  }}
                >
                  Vue d'ensemble de vos opérations de location
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button style={secondaryButtonStyle} onClick={openAssetForm}>
                  + Ajouter un équipement
                </button>

                <button
                  style={primaryButtonStyle}
                  onClick={() =>
                    window.alert(
                      'La création de location sera notre prochain module.'
                    )
                  }
                >
                  + Nouvelle location
                </button>
              </div>
            </div>

            {loadError ? (
              <div
                style={{
                  ...cardStyle,
                  borderColor: '#ef4444',
                  color: '#991b1b',
                }}
              >
                <strong>Impossible de charger l’inventaire.</strong>
                <div style={{ marginTop: '6px' }}>{loadError}</div>
                <button
                  style={{ ...secondaryButtonStyle, marginTop: '14px' }}
                  onClick={() => void loadAssets()}
                >
                  Réessayer
                </button>
              </div>
            ) : null}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
              }}
            >
              {dashboardStats.map((stat) => (
                <div key={stat.label} style={cardStyle}>
                  <div
                    style={{
                      color: '#6b7280',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    {stat.label}
                  </div>
                  <div
                    style={{
                      fontSize: '32px',
                      lineHeight: '38px',
                      fontWeight: 700,
                      marginTop: '8px',
                    }}
                  >
                    {loading ? '…' : stat.value}
                  </div>
                </div>
              ))}
            </div>

            <div style={cardStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '20px',
                }}
              >
                <h2 style={sectionTitleStyle}>Inventaire</h2>
                <button style={secondaryButtonStyle} onClick={openAssetForm}>
                  + Ajouter
                </button>
              </div>

              {loading ? (
                <div style={{ color: '#6b7280' }}>Chargement de l’inventaire…</div>
              ) : assets.length === 0 ? (
                <div
                  style={{
                    padding: '44px 20px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px dashed #d1d5db',
                  }}
                >
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      marginBottom: '8px',
                    }}
                  >
                    Aucun équipement pour le moment
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      marginBottom: '20px',
                    }}
                  >
                    Ajoutez votre premier actif pour commencer à utiliser RentalFlow.
                  </div>
                  <button style={primaryButtonStyle} onClick={openAssetForm}>
                    Ajouter un équipement
                  </button>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      minWidth: '680px',
                    }}
                  >
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                        <th style={{ padding: '10px 8px' }}>Actif</th>
                        <th style={{ padding: '10px 8px' }}>Numéro</th>
                        <th style={{ padding: '10px 8px' }}>Type</th>
                        <th style={{ padding: '10px 8px' }}>Statut</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>
                          Tarif / jour
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.slice(0, 10).map((asset, index) => (
                        <tr
                          key={asset._id ?? `${asset.assetNumber}-${index}`}
                          style={{ borderTop: '1px solid #e5e7eb' }}
                        >
                          <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                            {asset.title || 'Sans nom'}
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            {asset.assetNumber || '—'}
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            {asset.productType || '—'}
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            {asset.status
                              ? statusLabels[asset.status]
                              : 'Non défini'}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                            {formatMoney(
                              asset.dailyRateCents,
                              asset.currency || 'CAD'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <h2 style={sectionTitleStyle}>État de l'inventaire</h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '16px',
                  marginTop: '20px',
                }}
              >
                <InventoryStatus label="Disponible" value={counts.available} />
                <InventoryStatus label="Réservé" value={counts.reserved} />
                <InventoryStatus label="En location" value={counts.rented} />
                <InventoryStatus label="Entretien" value={counts.maintenance} />
              </div>
            </div>
          </div>
        </Page.Content>
      </Page>

      {formOpen ? (
        <div
          role="presentation"
          onMouseDown={closeAssetForm}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 9999,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-asset-title"
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: '14px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
            }}
          >
            <form onSubmit={saveAsset}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '20px 24px',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <div>
                  <h2 id="add-asset-title" style={{ margin: 0, fontSize: '22px' }}>
                    Ajouter un équipement
                  </h2>
                  <div
                    style={{
                      color: '#6b7280',
                      fontSize: '14px',
                      marginTop: '4px',
                    }}
                  >
                    Créez une unité physique pouvant être réservée et louée.
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Fermer"
                  onClick={closeAssetForm}
                  disabled={saving}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: '26px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ padding: '24px' }}>
                {formError ? (
                  <div
                    style={{
                      background: '#fef2f2',
                      color: '#991b1b',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      marginBottom: '18px',
                    }}
                  >
                    {formError}
                  </div>
                ) : null}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '18px',
                  }}
                >
                  <Field label="Nom de l’équipement *">
                    <input
                      autoFocus
                      style={inputStyle}
                      value={form.title}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="Ex. Kayak Pelican"
                    />
                  </Field>

                  <Field label="Numéro d’actif *">
                    <input
                      style={inputStyle}
                      value={form.assetNumber}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          assetNumber: event.target.value,
                        }))
                      }
                      placeholder="Ex. KAY-001"
                    />
                  </Field>

                  <Field label="Type de produit">
                    <input
                      style={inputStyle}
                      value={form.productType}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          productType: event.target.value,
                        }))
                      }
                      placeholder="Ex. Kayak"
                    />
                  </Field>

                  <Field label="Numéro de série">
                    <input
                      style={inputStyle}
                      value={form.serialNumber}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          serialNumber: event.target.value,
                        }))
                      }
                      placeholder="Optionnel"
                    />
                  </Field>

                  <Field label="Tarif journalier">
                    <input
                      style={inputStyle}
                      inputMode="decimal"
                      value={form.dailyRate}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          dailyRate: event.target.value,
                        }))
                      }
                      placeholder="49,99"
                    />
                  </Field>

                  <Field label="Devise">
                    <select
                      style={inputStyle}
                      value={form.currency}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          currency: event.target.value,
                        }))
                      }
                    >
                      <option value="CAD">CAD - Dollar canadien</option>
                      <option value="USD">USD - Dollar américain</option>
                      <option value="EUR">EUR - Euro</option>
                    </select>
                  </Field>

                  <Field label="Statut">
                    <select
                      style={inputStyle}
                      value={form.status}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          status: event.target.value as AssetStatus,
                        }))
                      }
                    >
                      <option value="AVAILABLE">Disponible</option>
                      <option value="RESERVED">Réservé</option>
                      <option value="RENTED">En location</option>
                      <option value="MAINTENANCE">Entretien</option>
                      <option value="INACTIVE">Inactif</option>
                    </select>
                  </Field>
                </div>

                <div style={{ marginTop: '18px' }}>
                  <Field label="Notes">
                    <textarea
                      style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                      value={form.notes}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      placeholder="Informations utiles sur cet équipement"
                    />
                  </Field>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  padding: '16px 24px',
                  borderTop: '1px solid #e5e7eb',
                }}
              >
                <button
                  type="button"
                  style={{
                    ...secondaryButtonStyle,
                    opacity: saving ? 0.6 : 1,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                  onClick={closeAssetForm}
                  disabled={saving}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{
                    ...primaryButtonStyle,
                    opacity: saving ? 0.6 : 1,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                  disabled={saving}
                >
                  {saving ? 'Enregistrement…' : 'Ajouter l’équipement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </WixDesignSystemProvider>
  );
};

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

const Field: FC<FieldProps> = ({ label, children }) => (
  <label style={{ display: 'block' }}>
    <span style={labelStyle}>{label}</span>
    {children}
  </label>
);

interface InventoryStatusProps {
  label: string;
  value: number;
}

const InventoryStatus: FC<InventoryStatusProps> = ({ label, value }) => (
  <div
    style={{
      background: '#f8fafc',
      borderRadius: '10px',
      padding: '16px',
    }}
  >
    <div style={{ fontSize: '13px', color: '#6b7280' }}>{label}</div>
    <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '5px' }}>
      {value}
    </div>
  </div>
);

export default DashboardPage;
