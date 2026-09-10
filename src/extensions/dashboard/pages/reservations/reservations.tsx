import type { CSSProperties, FC } from 'react';
import { useState } from 'react';
import { Page, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import { getCurrentPlan, hasFeature, planLabels } from '../../../../lib/plans';

type CalendarView = 'MONTH' | 'WEEK' | 'LIST' | 'AVAILABILITY';

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,.06)',
};

const button: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  padding: '9px 14px',
  background: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
};

const ReservationsPage: FC = () => {
  const plan = getCurrentPlan();
  const advancedViews = hasFeature(plan, 'ADVANCED_CALENDAR_VIEWS');
  const [view, setView] = useState<CalendarView>('MONTH');

  const selectView = (next: CalendarView) => {
    if ((next === 'WEEK' || next === 'AVAILABILITY') && !advancedViews) return;
    setView(next);
  };

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header
          title="Calendrier / Réservations"
          subtitle="Planifiez les locations et vérifiez la disponibilité de vos équipements."
        />
        <Page.Content>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <ViewButton active={view === 'MONTH'} onClick={() => selectView('MONTH')}>Mois</ViewButton>
                <ViewButton active={view === 'WEEK'} locked={!advancedViews} onClick={() => selectView('WEEK')}>Semaine</ViewButton>
                <ViewButton active={view === 'LIST'} onClick={() => selectView('LIST')}>Liste</ViewButton>
                <ViewButton active={view === 'AVAILABILITY'} locked={!advancedViews} onClick={() => selectView('AVAILABILITY')}>Disponibilité</ViewButton>
              </div>
              <div style={{ color: '#64748b', fontSize: 13 }}>Plan actuel : <strong>{planLabels[plan]}</strong></div>
            </div>

            {!advancedViews && (
              <div style={{ ...card, background: '#faf5ff', borderColor: '#d8b4fe', color: '#6b21a8' }}>
                Les vues Semaine et Disponibilité sont incluses à partir du plan Business.
              </div>
            )}

            <div style={{ ...card, minHeight: 460 }}>
              {view === 'MONTH' && <Placeholder title="Vue mensuelle" text="Les réservations seront affichées par équipement et par date." />}
              {view === 'WEEK' && <Placeholder title="Vue hebdomadaire" text="Vue opérationnelle détaillée des départs, retours et périodes bloquées." />}
              {view === 'LIST' && <Placeholder title="Vue liste" text="Liste filtrable des réservations à venir, en cours et terminées." />}
              {view === 'AVAILABILITY' && <Placeholder title="Recherche de disponibilité" text="Choisissez une période pour voir immédiatement quels équipements peuvent être loués." />}
            </div>

            <div style={card}>
              <h3 style={{ marginTop: 0 }}>Prochain jalon</h3>
              <p style={{ marginBottom: 0, color: '#475569' }}>
                Nous allons créer la collection Reservations, lier chaque réservation à un équipement, empêcher les chevauchements et calculer automatiquement le tarif selon le nombre de jours.
              </p>
            </div>
          </div>
        </Page.Content>
      </Page>
    </WixDesignSystemProvider>
  );
};

const ViewButton: FC<{ active: boolean; locked?: boolean; onClick: () => void; children: string }> = ({ active, locked, onClick, children }) => (
  <button
    onClick={onClick}
    title={locked ? 'Plan Business requis' : undefined}
    style={{
      ...button,
      background: active ? '#116dff' : '#fff',
      color: active ? '#fff' : locked ? '#94a3b8' : '#0f172a',
      borderColor: active ? '#116dff' : '#cbd5e1',
      cursor: locked ? 'not-allowed' : 'pointer',
      opacity: locked ? .65 : 1,
    }}
  >
    {locked ? '🔒 ' : ''}{children}
  </button>
);

const Placeholder: FC<{ title: string; text: string }> = ({ title, text }) => (
  <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
    <div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{title}</div>
      <div style={{ color: '#64748b', marginTop: 8, maxWidth: 560 }}>{text}</div>
      <div style={{ marginTop: 24, padding: 18, background: '#f8fafc', borderRadius: 10, color: '#64748b' }}>
        Aucune réservation pour le moment.
      </div>
    </div>
  </div>
);

export default ReservationsPage;
