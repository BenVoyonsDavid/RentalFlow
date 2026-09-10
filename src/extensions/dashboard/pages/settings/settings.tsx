import type { CSSProperties, FC } from 'react';
import { Page, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import { getCurrentPlan, planLabels } from '../../../../lib/plans';

const card: CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
  padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.06)',
};

const SettingsPage: FC = () => {
  const plan = getCurrentPlan();
  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header title="Paramètres" subtitle="Configuration générale de RentalFlow et fonctionnalités de votre abonnement." />
        <Page.Content>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
            <div style={card}>
              <h2 style={{ marginTop: 0 }}>Abonnement</h2>
              <div style={{ fontSize: 18 }}>Plan actuel : <strong>{planLabels[plan]}</strong></div>
              <p style={{ color: '#64748b', marginBottom: 0 }}>Pendant le développement, RentalFlow simule le plan Pro pour permettre le test de toutes les fonctions. Avant la publication App Market, cette valeur sera branchée au forfait réellement installé dans Wix.</p>
            </div>

            <div style={card}>
              <h2 style={{ marginTop: 0 }}>Fonctionnalités par plan — proposition v1</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
                  <thead><tr style={{ textAlign: 'left', color: '#64748b' }}><th style={{ padding: 10 }}>Fonction</th><th>Gratuit</th><th>Starter</th><th>Business</th><th>Pro</th></tr></thead>
                  <tbody>
                    <FeatureRow label="Inventaire et tarif journalier" values={[true, true, true, true]} />
                    <FeatureRow label="Réservations + anti-double réservation" values={[true, true, true, true]} />
                    <FeatureRow label="Buffers avant/après" values={[true, true, true, true]} />
                    <FeatureRow label="Clients" values={[true, true, true, true]} />
                    <FeatureRow label="Tarif hebdomadaire" values={[false, true, true, true]} />
                    <FeatureRow label="Devis, contrats et factures" values={[false, true, true, true]} />
                    <FeatureRow label="Paiements et dépôts de sécurité" values={[false, true, true, true]} />
                    <FeatureRow label="Tarif mensuel" values={[false, false, true, true]} />
                    <FeatureRow label="Rabais longue durée" values={[false, false, true, true]} />
                    <FeatureRow label="Rabais permanent client" values={[false, false, true, true]} />
                    <FeatureRow label="Vue semaine + disponibilité avancée" values={[false, false, true, true]} />
                    <FeatureRow label="Inspections, dommages et signatures" values={[false, false, true, true]} />
                    <FeatureRow label="Historique complet" values={[false, false, true, true]} />
                    <FeatureRow label="Inventaire illimité" values={[false, false, false, true]} />
                    <FeatureRow label="Automatisations / fonctions avancées futures" values={[false, false, false, true]} />
                  </tbody>
                </table>
              </div>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 0, marginTop: 16 }}>Cette matrice est la base de la première version. Les prix et limites quantitatives seront finalisés avant la soumission App Market.</p>
            </div>

            <div style={card}>
              <h2 style={{ marginTop: 0 }}>Réglages généraux — v1</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 18 }}>
                <Setting label="Devise par défaut" value="CAD — Dollar canadien" />
                <Setting label="Durée minimale" value="1 jour" />
                <Setting label="Buffer" value="Configurable par réservation" />
                <Setting label="Fuseau horaire" value="Fuseau horaire du site Wix" />
                <Setting label="Statut initial" value="Disponible / Réservation confirmée" />
                <Setting label="Paiement réel Wix" value="Connexion prévue après validation du MVP" />
              </div>
            </div>

            <div style={card}>
              <h2 style={{ marginTop: 0 }}>Flux opérationnel</h2>
              <div style={{ lineHeight: 1.9, color: '#334155' }}>Réservation → Devis → Contrat → Facture → Paiement / dépôt → Inspection départ → Départ → Inspection retour / dommages → Retour → Clôture</div>
            </div>
          </div>
        </Page.Content>
      </Page>
    </WixDesignSystemProvider>
  );
};

const FeatureRow: FC<{ label: string; values: boolean[] }> = ({ label, values }) => <tr style={{ borderTop: '1px solid #e5e7eb' }}><td style={{ padding: 12, fontWeight: 600 }}>{label}</td>{values.map((enabled, index) => <td key={index} style={{ padding: 12 }}>{enabled ? '✓' : '—'}</td>)}</tr>;
const Setting: FC<{ label: string; value: string }> = ({ label, value }) => <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16 }}><div style={{ color: '#64748b', fontSize: 13 }}>{label}</div><div style={{ fontWeight: 700, marginTop: 5 }}>{value}</div></div>;
export default SettingsPage;
