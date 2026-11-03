import type { CSSProperties, FC } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { httpClient } from '@wix/essentials';
import { Page, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import { COLLECTIONS } from '../../../../lib/collection-ids';
import { loadAllDashboardItems } from '../../../../lib/dashboard-data';
import { sendRentalFlowBiEvent } from '../../../../lib/bi-events-client';
import { getOperationsForDashboard, type OperationsFilter } from '../../../../lib/management-filters';
import type { Asset, Reservation } from '../../../../domain/types';

const ASSETS = COLLECTIONS.assets;
const RESERVATIONS = COLLECTIONS.reservations;
const card: CSSProperties = { background: '#fff', border: '1px solid #e1e7ee', borderRadius: 16, padding: 22, boxShadow: '0 4px 16px rgba(19,40,66,.04)' };
const muted: CSSProperties = { color: '#64748b', fontSize: 13 };
const button: CSSProperties = { background: '#fff', border: '1px solid #cbd5e1', borderRadius: 10, color: '#164a69', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '10px 16px' };

function asDate(value?: Date | string): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
function dateTime(value?: Date | string): string {
  const date = asDate(value);
  return date ? new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : '—';
}
function money(cents = 0, currency = 'CAD'): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency }).format(cents / 100);
}

const DashboardPage: FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [focus, setFocus] = useState<OperationsFilter>('DEPARTURES');
  const dashboardLoadedTracked = useRef(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        // Payment reconciliation must never prevent the dashboard from opening.
        try {
          await httpClient.fetchWithAuth(
            `${import.meta.env.BASE_API_URL}/api/reconcile-payments`,
            { method: 'POST' },
          );
        } catch (paymentSyncError) {
          console.warn('RentalFlow payment reconciliation skipped.', paymentSyncError);
        }
        const [loadedAssets, loadedReservations] = await Promise.all([
          loadAllDashboardItems<Asset>(ASSETS),
          loadAllDashboardItems<Reservation>(RESERVATIONS),
        ]);
        if (active) {
          setAssets(loadedAssets);
          setReservations(loadedReservations);
          setLastUpdated(new Date());
          if (!dashboardLoadedTracked.current) {
            dashboardLoadedTracked.current = true;
            // BI failures never interrupt dashboard loading. No customer data is sent.
            void sendRentalFlowBiEvent({ eventName: 'APP_DASHBOARD_LOADED' });
          }
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Impossible de charger les données RentalFlow.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [refreshKey]);

  const inventory = useMemo(() => {
    const current = assets.filter((asset) => asset.active !== false && asset.status !== 'INACTIVE');
    return {
      total: current.length,
      available: current.filter((asset) => asset.status === 'AVAILABLE').length,
      reserved: current.filter((asset) => asset.status === 'RESERVED').length,
      rented: current.filter((asset) => asset.status === 'RENTED').length,
      maintenance: current.filter((asset) => asset.status === 'MAINTENANCE').length,
    };
  }, [assets]);

  const operations = useMemo(() => getOperationsForDashboard(reservations), [reservations]);
  const activeCount = useMemo(() => reservations.filter(
    (r) => !['CANCELLED', 'COMPLETED', 'ERROR'].includes(r.status || ''),
  ).length, [reservations]);
  const bookedCad = useMemo(() => reservations
    .filter((r) => !['CANCELLED', 'ERROR'].includes(r.status || '') && (r.currency || 'CAD') === 'CAD')
    .reduce((sum, r) => sum + (r.totalCents || 0), 0), [reservations]);

  const queues: Record<OperationsFilter, Reservation[]> = {
    DEPARTURES: operations.departures,
    RETURNS: operations.returns,
    LATE: operations.late,
    PREPARE: operations.prepare,
  };
  const focusLabels: Record<OperationsFilter, string> = {
    DEPARTURES: 'Départs du jour',
    RETURNS: 'Retours du jour',
    LATE: 'Retards à traiter',
    PREPARE: 'À préparer (24 h)',
  };
  const focusedReservations = queues[focus];

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header title="Tableau de bord" subtitle="Votre centre de contrôle pour les locations." />
        <Page.Content>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
            <section style={{ ...card, background: 'linear-gradient(115deg,#12263b,#174b64)', color: '#fff', border: 0, padding: '26px 28px' }}>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: '#98d8e3' }}>Vue opérationnelle</div>
                  <h2 style={{ margin: '8px 0 6px', fontSize: 25, color: '#fff' }}>Vos locations, en un coup d’œil</h2>
                  <p style={{ margin: 0, color: '#d8e6ee', fontSize: 14 }}>Retrouvez les départs, les retours et les actions prioritaires sans chercher dans le calendrier.</p>
                  {lastUpdated && <div style={{ marginTop: 10, color: '#bdd3e1', fontSize: 12 }}>Actualisé le {dateTime(lastUpdated)}</div>}
                </div>
                <button type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading} style={{ ...button, opacity: loading ? .65 : 1 }}>
                  {loading ? 'Actualisation…' : '↻ Actualiser'}
                </button>
              </div>
            </section>

            {error && <div role="alert" style={{ ...card, background: '#fff1f2', color: '#991b1b', borderColor: '#fecdd3' }}>{error} <button type="button" style={{ ...button, marginLeft: 10 }} onClick={() => setRefreshKey((key) => key + 1)}>Réessayer</button></div>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(175px,1fr))', gap: 12 }} aria-busy={loading}>
              <Metric label="Équipements actifs" value={inventory.total} loading={loading} detail="Unités gérées" />
              <Metric label="Disponibles" value={inventory.available} loading={loading} detail="Statut manuel" />
              <Metric label="Réservations actives" value={activeCount} loading={loading} detail="Hors clôturées et annulées" />
              <Metric label="En location" value={reservations.filter((r) => r.status === 'RENTED').length} loading={loading} detail="Réservations en cours" />
              <Metric label="Montants réservés (CAD)" value={money(bookedCad)} loading={loading} detail="Total contractuel, non encaissé" />
            </div>

            <section style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: 19 }}>À traiter</h2>
                  <div style={muted}>Sélectionnez une catégorie pour voir les réservations concernées.</div>
                </div>
              </div>
              <div role="group" aria-label="Priorités opérationnelles" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 10 }}>
                <QueueButton label="Départs" count={operations.departures.length} active={focus === 'DEPARTURES'} onClick={() => setFocus('DEPARTURES')} />
                <QueueButton label="Retours" count={operations.returns.length} active={focus === 'RETURNS'} onClick={() => setFocus('RETURNS')} />
                <QueueButton label="Retards" count={operations.late.length} active={focus === 'LATE'} onClick={() => setFocus('LATE')} danger={operations.late.length > 0} />
                <QueueButton label="À préparer (24 h)" count={operations.prepare.length} active={focus === 'PREPARE'} onClick={() => setFocus('PREPARE')} />
              </div>
              <div style={{ marginTop: 18, borderTop: '1px solid #e2e8f0', paddingTop: 16 }} aria-live="polite">
                <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>{focusLabels[focus]}</h3>
                {loading ? <div style={muted}>Chargement…</div> : focusedReservations.length === 0
                  ? <div style={{ padding: 20, borderRadius: 10, background: '#f8fafc', color: '#64748b' }}>Aucune réservation à traiter dans cette catégorie.</div>
                  : <div style={{ display: 'grid', gap: 9 }}>
                    {focusedReservations.slice(0, 8).map((reservation) => (
                      <ReservationPreview key={reservation._id || reservation.reservationNumber} reservation={reservation} />
                    ))}
                    {focusedReservations.length > 8 && <div style={muted}>{focusedReservations.length - 8} autre(s) réservation(s) dans cette catégorie.</div>}
                  </div>}
              </div>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
              <section style={card}>
                <h2 style={{ fontSize: 19, marginTop: 0 }}>Prochaines réservations</h2>
                {loading ? <div style={muted}>Chargement…</div>
                  : operations.upcoming.length === 0
                    ? <div style={{ ...muted, padding: 18, background: '#f8fafc', borderRadius: 10 }}>Aucune réservation à venir.</div>
                    : <div style={{ display: 'grid', gap: 9 }}>
                      {operations.upcoming.slice(0, 6).map((reservation) => <ReservationPreview key={reservation._id || reservation.reservationNumber} reservation={reservation} />)}
                    </div>}
              </section>
              <section style={card}>
                <h2 style={{ fontSize: 19, marginTop: 0 }}>Inventaire physique</h2>
                <p style={muted}>Statut attribué aux équipements. La disponibilité par période est vérifiée dans le calendrier.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
                  <MiniStat label="Disponible" value={inventory.available} />
                  <MiniStat label="Réservé" value={inventory.reserved} />
                  <MiniStat label="En location" value={inventory.rented} />
                  <MiniStat label="Entretien" value={inventory.maintenance} />
                </div>
                {!loading && inventory.total === 0 && <p style={{ ...muted, marginTop: 16 }}>Ajoutez votre premier équipement dans la page Équipements pour commencer.</p>}
              </section>
            </div>
          </div>
        </Page.Content>
      </Page>
    </WixDesignSystemProvider>
  );
};

const Metric: FC<{ label: string; value: number | string; loading: boolean; detail: string }> = ({ label, value, loading, detail }) =>
  <div style={{ ...card, padding: 19 }}>
    <div style={{ color: '#536579', fontSize: 13, fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: typeof value === 'string' ? 23 : 32, color: '#17314b', fontWeight: 800, marginTop: 10 }}>{loading ? '…' : value}</div>
    <div style={{ ...muted, marginTop: 6, fontSize: 11 }}>{detail}</div>
  </div>;

const MiniStat: FC<{ label: string; value: number }> = ({ label, value }) =>
  <div style={{ background: '#f5f8fb', borderRadius: 12, padding: 16 }}>
    <div style={muted}>{label}</div><div style={{ fontSize: 25, fontWeight: 800, color: '#17314b', marginTop: 5 }}>{value}</div>
  </div>;

const QueueButton: FC<{ label: string; count: number; active: boolean; danger?: boolean; onClick: () => void }> = ({ label, count, active, danger, onClick }) =>
  <button type="button" aria-pressed={active} onClick={onClick} style={{
    border: active ? '2px solid #136d89' : '1px solid #dbe5ec', borderRadius: 12,
    background: active ? '#eff9fb' : danger ? '#fff5f4' : '#fff',
    padding: 14, textAlign: 'left', cursor: 'pointer', color: danger ? '#9f2929' : '#17314b',
  }}>
    <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{label}</span>
    <strong style={{ display: 'block', fontSize: 25, marginTop: 4 }}>{count}</strong>
  </button>;

const ReservationPreview: FC<{ reservation: Reservation }> = ({ reservation }) =>
  <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12, border: '1px solid #e2e8f0', background: '#fbfdff', padding: 13, borderRadius: 11, flexWrap: 'wrap' }}>
    <div>
      <strong style={{ color: '#18354e', fontSize: 14 }}>{reservation.reservationNumber || 'Réservation'} · {reservation.customerName || 'Client'}</strong>
      <div style={{ ...muted, marginTop: 5 }}>{dateTime(reservation.startDateTime)} → {dateTime(reservation.endDateTime)}</div>
    </div>
    <div style={{ textAlign: 'right' }}>
      <strong style={{ color: '#19384f' }}>{money(reservation.totalCents || 0, reservation.currency || 'CAD')}</strong>
      <div style={{ ...muted, marginTop: 4 }}>{reservation.status || '—'}</div>
    </div>
  </div>;

export default DashboardPage;
