import type { CSSProperties, FC } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { items } from '@wix/data';
import { Page, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';

const ASSETS_COLLECTION = '@pilotedavid1/rental-flow/assets';

type AssetStatus = 'AVAILABLE' | 'RESERVED' | 'RENTED' | 'MAINTENANCE' | 'INACTIVE';
type Asset = { status?: AssetStatus; active?: boolean };

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,.06)',
};

const DashboardPage: FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const result = await items.query(ASSETS_COLLECTION).limit(1000).find();
        if (active) setAssets(result.items as Asset[]);
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : 'Impossible de charger les données RentalFlow.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, []);

  const counts = useMemo(() => {
    const current = assets.filter((asset) => asset.active !== false);
    return {
      total: current.length,
      available: current.filter((asset) => asset.status === 'AVAILABLE').length,
      reserved: current.filter((asset) => asset.status === 'RESERVED').length,
      rented: current.filter((asset) => asset.status === 'RENTED').length,
      maintenance: current.filter((asset) => asset.status === 'MAINTENANCE').length,
    };
  }, [assets]);

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header
          title="Tableau de bord"
          subtitle="Vue d’ensemble de votre activité de location."
        />
        <Page.Content>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
            {error && (
              <div style={{ ...card, background: '#fef2f2', color: '#991b1b', borderColor: '#fecaca' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>
              <Stat label="Équipements actifs" value={counts.total} loading={loading} />
              <Stat label="Disponibles" value={counts.available} loading={loading} />
              <Stat label="Réservés" value={counts.reserved} loading={loading} />
              <Stat label="En location" value={counts.rented} loading={loading} />
              <Stat label="En entretien" value={counts.maintenance} loading={loading} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
              <div style={card}>
                <h2 style={{ marginTop: 0 }}>Aujourd’hui</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <MiniStat label="Départs" value={0} />
                  <MiniStat label="Retours" value={0} />
                  <MiniStat label="Retards" value={0} />
                  <MiniStat label="À préparer" value={0} />
                </div>
                <p style={{ color: '#6b7280', marginBottom: 0, marginTop: 18 }}>
                  Ces compteurs seront alimentés automatiquement dès que le module Réservations sera connecté.
                </p>
              </div>

              <div style={card}>
                <h2 style={{ marginTop: 0 }}>Accès rapide</h2>
                <p style={{ color: '#475569' }}>
                  Utilisez le menu RentalFlow dans la barre latérale Wix pour ouvrir chaque espace de travail.
                </p>
                <div style={{ display: 'grid', gap: 10 }}>
                  <Quick label="Équipements" text="Inventaire, statuts et tarification" />
                  <Quick label="Calendrier / Réservations" text="Mois, semaine, liste et disponibilités" />
                  <Quick label="Paramètres" text="Devise, abonnements et options de l’entreprise" />
                </div>
              </div>
            </div>

            <div style={card}>
              <h2 style={{ marginTop: 0 }}>Prochaine étape</h2>
              <p style={{ marginBottom: 0, color: '#475569' }}>
                Le prochain module reliera les réservations aux équipements afin de bloquer automatiquement les périodes indisponibles et calculer le meilleur tarif selon la durée.
              </p>
            </div>
          </div>
        </Page.Content>
      </Page>
    </WixDesignSystemProvider>
  );
};

const Stat: FC<{ label: string; value: number; loading: boolean }> = ({ label, value, loading }) => (
  <div style={card}>
    <div style={{ color: '#64748b', fontSize: 14 }}>{label}</div>
    <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8 }}>{loading ? '…' : value}</div>
  </div>
);

const MiniStat: FC<{ label: string; value: number }> = ({ label, value }) => (
  <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16 }}>
    <div style={{ color: '#64748b', fontSize: 13 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{value}</div>
  </div>
);

const Quick: FC<{ label: string; text: string }> = ({ label, text }) => (
  <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14 }}>
    <div style={{ fontWeight: 700 }}>{label}</div>
    <div style={{ color: '#64748b', fontSize: 13, marginTop: 3 }}>{text}</div>
  </div>
);

export default DashboardPage;
