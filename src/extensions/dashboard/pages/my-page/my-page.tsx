import { feedback, formatFeedback, type Feedback } from '../../../../lib/i18n';
import { statusLabel } from '../../../../lib/i18n/status';
import { t, getLocale } from '../../../../lib/i18n';
import { LanguageSelector, useLanguage } from '../../../../lib/i18n/react';
import type { CSSProperties, FC } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { items } from '@wix/data';
import { Page, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';

const ASSETS = '@pilotedavid1/rental-flow/assets';
const RESERVATIONS = '@pilotedavid1/rental-flow/reservations';

type AssetStatus = 'AVAILABLE' | 'RESERVED' | 'RENTED' | 'MAINTENANCE' | 'INACTIVE';
type Asset = { status?: AssetStatus; active?: boolean };
type Reservation = {
  _id?: string; reservationNumber?: string; customerName?: string; startDateTime?: Date | string;
  endDateTime?: Date | string; status?: string; workflowStage?: string; totalCents?: number; currency?: string;
};

const card: CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.06)' };

function asDate(value?: Date | string): Date {
  if (value instanceof Date) return value;
  return value ? new Date(value) : new Date(0);
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function dateTime(value?: Date | string): string {
  const date = asDate(value);
  if (!date.getTime()) return '—';
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
function money(cents = 0, currency = 'CAD'): string {
  return new Intl.NumberFormat(getLocale(), { style: 'currency', currency }).format(cents / 100);
}

const DashboardPage: FC = () => {
  const language = useLanguage();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Feedback>('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [assetResult, reservationResult] = await Promise.all([
          items.query(ASSETS).limit(1000).find(),
          items.query(RESERVATIONS).limit(1000).find(),
        ]);
        if (active) {
          setAssets(assetResult.items as Asset[]);
          setReservations(reservationResult.items as Reservation[]);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : feedback("Impossible de charger les données RentalFlow."));
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, []);

  const inventory = useMemo(() => {
    const current = assets.filter((asset) => asset.active !== false);
    return {
      total: current.length,
      available: current.filter((asset) => asset.status === 'AVAILABLE').length,
      reserved: current.filter((asset) => asset.status === 'RESERVED').length,
      rented: current.filter((asset) => asset.status === 'RENTED').length,
      maintenance: current.filter((asset) => asset.status === 'MAINTENANCE').length,
    };
  }, [assets]);

  const operations = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const activeReservations = reservations.filter((reservation) => !['CANCELLED', 'ERROR', 'COMPLETED'].includes(reservation.status || ''));
    const departures = activeReservations.filter((reservation) => reservation.status === 'CONFIRMED' && sameDay(asDate(reservation.startDateTime), now));
    const returns = activeReservations.filter((reservation) => reservation.status === 'RENTED' && sameDay(asDate(reservation.endDateTime), now));
    const late = activeReservations.filter((reservation) => reservation.status === 'RENTED' && asDate(reservation.endDateTime) < now);
    const prepare = activeReservations.filter((reservation) => reservation.status === 'CONFIRMED' && asDate(reservation.startDateTime) >= now && asDate(reservation.startDateTime) <= tomorrow);
    const upcoming = activeReservations
      .filter((reservation) => asDate(reservation.startDateTime) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
      .sort((a, b) => asDate(a.startDateTime).getTime() - asDate(b.startDateTime).getTime())
      .slice(0, 6);
    const bookedRevenue = reservations
      .filter((reservation) => !['CANCELLED', 'ERROR'].includes(reservation.status || ''))
      .reduce((sum, reservation) => sum + (reservation.totalCents || 0), 0);
    return { departures, returns, late, prepare, upcoming, bookedRevenue };
  }, [reservations]);

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <div lang={language}>
      <LanguageSelector />
      <Page>
        <Page.Header title={t("Tableau de bord")} subtitle={t("Vue d’ensemble de votre activité de location.")} />
        <Page.Content>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
            {error && <div style={{ ...card, background: '#fef2f2', color: '#991b1b', borderColor: '#fecaca' }}>{formatFeedback(error)}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>
              <Stat label={t("Équipements actifs")} value={inventory.total} loading={loading} />
              <Stat label={t("Disponibles")} value={inventory.available} loading={loading} />
              <Stat label={t("Réservations actives")} value={reservations.filter((r) => !['CANCELLED', 'COMPLETED', 'ERROR'].includes(r.status || '')).length} loading={loading} />
              <Stat label={t("En location")} value={reservations.filter((r) => r.status === 'RENTED').length} loading={loading} />
              <Stat label={t("Revenus réservés")} value={money(operations.bookedRevenue)} loading={loading} text />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
              <div style={card}>
                <h2 style={{ marginTop: 0 }}>{t("Aujourd’hui")}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <MiniStat label={t("Départs")} value={operations.departures.length} />
                  <MiniStat label={t("Retours")} value={operations.returns.length} />
                  <MiniStat label={t("Retards")} value={operations.late.length} alert={operations.late.length > 0} />
                  <MiniStat label={t("À préparer (24 h)")} value={operations.prepare.length} />
                </div>
              </div>

              <div style={card}>
                <h2 style={{ marginTop: 0 }}>{t("État de l’inventaire")}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <MiniStat label={t("Disponible")} value={inventory.available} />
                  <MiniStat label={t("Réservé manuel")} value={inventory.reserved} />
                  <MiniStat label={t("En location manuel")} value={inventory.rented} />
                  <MiniStat label={t("Entretien")} value={inventory.maintenance} />
                </div>
              </div>
            </div>

            <div style={card}>
              <h2 style={{ marginTop: 0 }}>{t("Prochaines réservations")}</h2>
              {loading ? <div>{t("Chargement…")}</div> : operations.upcoming.length === 0 ? <div style={{ color: '#64748b' }}>{t("Aucune réservation à venir.")}</div> : <div style={{ display: 'grid', gap: 9 }}>{operations.upcoming.map((reservation) => <div key={reservation._id || reservation.reservationNumber} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 13, background: '#f8fafc', borderRadius: 10, flexWrap: 'wrap' }}><div><strong>{reservation.reservationNumber || t("Réservation")} · {reservation.customerName || t("Client")}</strong><div style={{ color: '#64748b', marginTop: 3 }}>{dateTime(reservation.startDateTime)} → {dateTime(reservation.endDateTime)}</div></div><div style={{ textAlign: 'right' }}><strong>{money(reservation.totalCents, reservation.currency || 'CAD')}</strong><div style={{ color: '#64748b', marginTop: 3 }}>{statusLabel(reservation.workflowStage || 'RESERVATION')}</div></div></div>)}</div>}
            </div>

            <div style={card}>
              <h2 style={{ marginTop: 0 }}>{t("Espaces RentalFlow")}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
                <Quick label={t("Équipements")} text={t("Inventaire, statuts et tarification")} />
                <Quick label={t("Calendrier / Réservations")} text={t("Disponibilités et flux complet")} />
                <Quick label={t("Clients")} text={t("Fiches clients et historique")} />
                <Quick label={t("Paramètres")} text={t("Abonnements et options")} />
              </div>
            </div>
          </div>
        </Page.Content>
      </Page>
    </div>
    </WixDesignSystemProvider>
  );
};

const Stat: FC<{ label: string; value: number | string; loading: boolean; text?: boolean }> = ({ label, value, loading }) => <div style={card}><div style={{ color: '#64748b', fontSize: 14 }}>{label}</div><div style={{ fontSize: typeof value === 'string' ? 25 : 32, fontWeight: 700, marginTop: 8 }}>{loading ? '…' : value}</div></div>;
const MiniStat: FC<{ label: string; value: number; alert?: boolean }> = ({ label, value, alert }) => <div style={{ background: alert ? '#fef2f2' : '#f8fafc', borderRadius: 10, padding: 16, color: alert ? '#991b1b' : undefined }}><div style={{ color: alert ? '#991b1b' : '#64748b', fontSize: 13 }}>{label}</div><div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{value}</div></div>;
const Quick: FC<{ label: string; text: string }> = ({ label, text }) => <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14 }}><div style={{ fontWeight: 700 }}>{label}</div><div style={{ color: '#64748b', fontSize: 13, marginTop: 3 }}>{text}</div></div>;

export default DashboardPage;
