import type { CSSProperties, FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { items } from '@wix/data';
import { Page, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';

const RESERVATIONS = '@pilotedavid1/rental-flow/reservations';
const RESERVATION_ITEMS = '@pilotedavid1/rental-flow/reservation-items';

type Reservation = {
  _id?: string;
  reservationNumber?: string;
  customerName?: string;
  startDateTime?: Date | string;
  endDateTime?: Date | string;
  bufferBeforeHours?: number;
  bufferAfterHours?: number;
  status?: string;
  workflowStage?: string;
  totalCents?: number;
  currency?: string;
};

type ReservationItem = {
  reservationId?: string;
  assetTitle?: string;
  assetNumber?: string;
};

const card: CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
  padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.06)',
};
const button: CSSProperties = {
  border: '1px solid #cbd5e1', borderRadius: 8, padding: '9px 13px',
  background: '#fff', cursor: 'pointer', fontWeight: 600,
};

const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function asDate(value?: Date | string): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayStart(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function dayEnd(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function monthCells(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const mondayIndex = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayIndex);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function money(cents = 0, currency = 'CAD'): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency }).format(cents / 100);
}

function dateTime(value?: Date | string): string {
  const date = asDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

const CalendarPage: FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationItems, setReservationItems] = useState<ReservationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selected, setSelected] = useState<Reservation | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [reservationResult, itemResult] = await Promise.all([
        items.query(RESERVATIONS).limit(1000).find(),
        items.query(RESERVATION_ITEMS).limit(1000).find(),
      ]);
      setReservations(reservationResult.items as Reservation[]);
      setReservationItems(itemResult.items as ReservationItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger le calendrier.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const cells = useMemo(() => monthCells(cursor), [cursor]);
  const visibleReservations = useMemo(
    () => reservations.filter((reservation) => reservation.status !== 'ERROR'),
    [reservations]
  );

  const reservationsForDay = (day: Date) => visibleReservations.filter((reservation) => {
    const start = asDate(reservation.startDateTime);
    const end = asDate(reservation.endDateTime);
    if (!start || !end) return false;
    return start <= dayEnd(day) && end >= dayStart(day);
  }).sort((a, b) => (asDate(a.startDateTime)?.getTime() || 0) - (asDate(b.startDateTime)?.getTime() || 0));

  const itemsFor = (reservation: Reservation) => reservationItems
    .filter((item) => item.reservationId === reservation._id)
    .map((item) => item.assetTitle || item.assetNumber)
    .filter(Boolean)
    .join(', ');

  const today = dayStart(new Date()).getTime();

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header title="Calendrier" subtitle="Vue mensuelle réelle des locations, départs, retours et périodes réservées." />
        <Page.Content>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 }}>
            {error && <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>{error}</div>}

            <div style={{ ...card, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={button} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹</button>
                  <button style={button} onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Aujourd’hui</button>
                  <button style={button} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>›</button>
                </div>
                <h2 style={{ margin: 0, textTransform: 'capitalize' }}>{new Intl.DateTimeFormat('fr-CA', { month: 'long', year: 'numeric' }).format(cursor)}</h2>
                <div style={{ color: '#64748b', fontSize: 13 }}>{visibleReservations.length} réservation(s)</div>
              </div>
            </div>

            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              {loading ? <div style={{ padding: 40, textAlign: 'center' }}>Chargement du calendrier…</div> : (
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ minWidth: 980 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                      {weekdays.map((day) => <div key={day} style={{ padding: '10px 8px', fontSize: 13, fontWeight: 700, color: '#475569', textAlign: 'center' }}>{day}</div>)}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                      {cells.map((day, index) => {
                        const inMonth = day.getMonth() === cursor.getMonth();
                        const isToday = dayStart(day).getTime() === today;
                        const dayReservations = reservationsForDay(day);
                        return (
                          <div key={day.toISOString()} style={{ minHeight: 138, padding: 8, borderRight: (index + 1) % 7 === 0 ? 'none' : '1px solid #e5e7eb', borderBottom: index >= 35 ? 'none' : '1px solid #e5e7eb', background: inMonth ? '#fff' : '#f8fafc' }}>
                            <div style={{ width: 28, height: 28, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: isToday ? 700 : 500, background: isToday ? '#116dff' : 'transparent', color: isToday ? '#fff' : inMonth ? '#0f172a' : '#94a3b8', marginBottom: 5 }}>{day.getDate()}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {dayReservations.slice(0, 4).map((reservation) => {
                                const cancelled = reservation.status === 'CANCELLED';
                                const rented = reservation.status === 'RENTED';
                                const returned = reservation.status === 'RETURNED' || reservation.status === 'COMPLETED';
                                return <button key={reservation._id || reservation.reservationNumber} onClick={() => setSelected(reservation)} title={`${reservation.reservationNumber || ''} · ${reservation.customerName || ''}`} style={{ border: '1px solid', borderColor: cancelled ? '#fecaca' : rented ? '#bfdbfe' : returned ? '#bbf7d0' : '#ddd6fe', background: cancelled ? '#fef2f2' : rented ? '#eff6ff' : returned ? '#f0fdf4' : '#f5f3ff', color: cancelled ? '#991b1b' : rented ? '#1e40af' : returned ? '#166534' : '#5b21b6', borderRadius: 6, padding: '5px 6px', textAlign: 'left', cursor: 'pointer', fontSize: 11, overflow: 'hidden' }}><div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{reservation.reservationNumber || 'Réservation'}</div><div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{reservation.customerName || 'Client'}</div></button>;
                              })}
                              {dayReservations.length > 4 ? <div style={{ fontSize: 11, color: '#64748b', paddingLeft: 4 }}>+ {dayReservations.length - 4} autre(s)</div> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: '#475569' }}>
              <span>🟣 Réservée / confirmée</span><span>🔵 En location</span><span>🟢 Retournée / clôturée</span><span>🔴 Annulée</span>
            </div>
          </div>
        </Page.Content>
      </Page>

      {selected && (
        <div onMouseDown={() => setSelected(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
          <div onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 620, background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><h2 style={{ margin: 0 }}>{selected.reservationNumber || 'Réservation'}</h2><div style={{ color: '#64748b', marginTop: 4 }}>{selected.customerName || 'Client'}</div></div><button style={{ border: 0, background: 'transparent', fontSize: 26, cursor: 'pointer' }} onClick={() => setSelected(null)}>×</button></div>
            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Info label="Début" value={dateTime(selected.startDateTime)} />
              <Info label="Fin" value={dateTime(selected.endDateTime)} />
              <Info label="Statut" value={selected.status || 'CONFIRMED'} />
              <Info label="Étape" value={selected.workflowStage || 'RESERVATION'} />
              <Info label="Buffer avant" value={`${selected.bufferBeforeHours || 0} h`} />
              <Info label="Buffer après" value={`${selected.bufferAfterHours || 0} h`} />
            </div>
            <div style={{ marginTop: 16 }}><Info label="Équipements" value={itemsFor(selected) || 'Aucun équipement'} /></div>
            <div style={{ marginTop: 16 }}><Info label="Total" value={money(selected.totalCents, selected.currency || 'CAD')} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}><button style={button} onClick={() => setSelected(null)}>Fermer</button></div>
          </div>
        </div>
      )}
    </WixDesignSystemProvider>
  );
};

const Info: FC<{ label: string; value: string }> = ({ label, value }) => <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}><div style={{ color: '#64748b', fontSize: 12 }}>{label}</div><div style={{ fontWeight: 600, marginTop: 4 }}>{value}</div></div>;

export default CalendarPage;
