import type { CSSProperties, FC } from 'react';
import { Page, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import { getCurrentPlan, planLabels } from '../../../../lib/plans';

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,.06)',
};

const SettingsPage: FC = () => {
  const plan = getCurrentPlan();

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header
          title="Paramètres"
          subtitle="Configuration générale de RentalFlow et fonctionnalités de votre abonnement."
        />
        <Page.Content>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
            <div style={card}>
              <h2 style={{ marginTop: 0 }}>Abonnement</h2>
              <div style={{ fontSize: 18 }}>Plan actuel : <strong>{planLabels[plan]}</strong></div>
              <p style={{ color: '#64748b', marginBottom: 0 }}>
                Pendant le développement, RentalFlow simule le plan Pro afin de permettre le test de toutes les fonctionnalités. Avant la publication, cette valeur sera remplacée par le plan réellement installé dans Wix.
              </p>
            </div>

            <div style={card}>
              <h2 style={{ marginTop: 0 }}>Fonctionnalités par plan</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: 10 }}>Fonction</th>
                      <th>Gratuit</th>
                      <th>Starter</th>
                      <th>Business</th>
                      <th>Pro</th>
                    </tr>
                  </thead>
                  <tbody>
                    <FeatureRow label="Tarif journalier" values={[true, true, true, true]} />
                    <FeatureRow label="Tarif hebdomadaire" values={[false, true, true, true]} />
                    <FeatureRow label="Tarif mensuel" values={[false, false, true, true]} />
                    <FeatureRow label="Rabais après X jours" values={[false, false, true, true]} />
                    <FeatureRow label="Vue calendrier Mois" values={[true, true, true, true]} />
                    <FeatureRow label="Vue calendrier Liste" values={[true, true, true, true]} />
                    <FeatureRow label="Vue calendrier Semaine" values={[false, false, true, true]} />
                    <FeatureRow label="Recherche de disponibilité" values={[false, false, true, true]} />
                    <FeatureRow label="Automatisations avancées" values={[false, false, false, true]} />
                  </tbody>
                </table>
              </div>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 0, marginTop: 16 }}>
                Cette matrice est notre base de développement. Les limites et prix finaux pourront être ajustés avant la publication App Market.
              </p>
            </div>

            <div style={card}>
              <h2 style={{ marginTop: 0 }}>Réglages généraux</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 18 }}>
                <Setting label="Devise par défaut" value="CAD — Dollar canadien" />
                <Setting label="Durée minimale" value="1 jour" />
                <Setting label="Fuseau horaire" value="Fuseau horaire du site Wix" />
                <Setting label="Statut initial d’un équipement" value="Disponible" />
              </div>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 0, marginTop: 16 }}>
                La sauvegarde de ces paramètres sera branchée à une collection Settings dans un prochain jalon.
              </p>
            </div>
          </div>
        </Page.Content>
      </Page>
    </WixDesignSystemProvider>
  );
};

const FeatureRow: FC<{ label: string; values: boolean[] }> = ({ label, values }) => (
  <tr style={{ borderTop: '1px solid #e5e7eb' }}>
    <td style={{ padding: 12, fontWeight: 600 }}>{label}</td>
    {values.map((enabled, index) => (
      <td key={index} style={{ padding: 12 }}>{enabled ? '✓' : '—'}</td>
    ))}
  </tr>
);

const Setting: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16 }}>
    <div style={{ color: '#64748b', fontSize: 13 }}>{label}</div>
    <div style={{ fontWeight: 700, marginTop: 5 }}>{value}</div>
  </div>
);

export default SettingsPage;
