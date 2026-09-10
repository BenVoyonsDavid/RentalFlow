import type { CSSProperties, FC, FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { items } from '@wix/data';
import { Page, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import { getCurrentPlan, hasFeature, planLabels } from '../../../../lib/plans';
import { calculateRentalPrice, getBlockedRange, rangesOverlap } from '../../../../lib/rental-pricing';

const ASSETS = '@pilotedavid1/rental-flow/assets';
const CUSTOMERS = '@pilotedavid1/rental-flow/customers';
const RESERVATIONS = '@pilotedavid1/rental-flow/reservations';
const RESERVATION_ITEMS = '@pilotedavid1/rental-flow/reservation-items';

type CalendarView = 'MONTH' | 'WEEK' | 'LIST' | 'AVAILABILITY';
type ReservationStatus = 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'ERROR';
type CustomerMode = 'EXISTING' | 'NEW';

type Asset = {
  _id?: string; title?: string; assetNumber?: string; productType?: string; status?: string;
  dailyRateCents?: number; weeklyRateCents?: number; monthlyRateCents?: number;
  discountAfterDays?: number; discountPercent?: number; currency?: string; active?: boolean;
};

type Customer = {
  _id?: string; customerNumber?: string; firstName?: string; lastName?: string; companyName?: string;
  email?: string; phone?: string; discountPercent?: number; active?: boolean;
};

type Reservation = {
  _id?: string; reservationNumber?: string; customerId?: string; customerNumber?: string;
  customerName?: string; customerEmail?: string; customerPhone?: string;
  startDateTime?: Date | string; endDateTime?: Date | string;
  bufferBeforeHours?: number; bufferAfterHours?: number; status?: ReservationStatus;
  subtotalCents?: number; customerDiscountPercent?: number; discountCents?: number;
  totalCents?: number; currency?: string; notes?: string;
};

type ReservationItem = {
  _id?: string; reservationId?: string; reservationNumber?: string; assetId?: string;
  assetNumber?: string; assetTitle?: string; startDateTime?: Date | string; endDateTime?: Date | string;
  blockedStartDateTime?: Date | string; blockedEndDateTime?: Date | string;
  bufferBeforeHours?: number; bufferAfterHours?: number; billableDays?: number;
  lineTotalCents?: number; pricingMode?: string; currency?: string; status?: ReservationStatus;
};

type ReservationForm = {
  customerMode: CustomerMode;
  customerId: string;
  newFirstName: string;
  newLastName: string;
  newCompanyName: string;
  newEmail: string;
  newPhone: string;
  startDateTime: string;
  endDateTime: string;
  bufferBeforeHours: string;
  bufferAfterHours: string;
  notes: string;
};

const blankForm: ReservationForm = {
  customerMode: 'EXISTING', customerId: '', newFirstName: '', newLastName: '', newCompanyName: '',
  newEmail: '', newPhone: '', startDateTime: '', endDateTime: '', bufferBeforeHours: '0', bufferAfterHours: '0', notes: '',
};

const card: CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.06)' };
const primary: CSSProperties = { border: 0, borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', background: '#116dff', color: '#fff' };
const secondary: CSSProperties = { ...primary, border: '1px solid #116dff', background: '#fff', color: '#116dff' };
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px', fontSize: 14, background: '#fff' };

function asDate(value: Date | string | undefined): Date {
  if (value instanceof Date) return value;
  return value ? new Date(value) : new Date(0);
}
function money(cents = 0, currency = 'CAD'): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency }).format(cents / 100);
}
function dateTime(value: Date | string | undefined): string {
  const date = asDate(value);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return '—';
  return new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
function numberValue(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
function reservationNumber(): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `RF-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
}
function customerNumber(): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `C-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
}
function customerName(customer: Customer): string {
  const person = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  return person || customer.companyName || 'Client sans nom';
}
function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

const ReservationsPage: FC = () => {
  const plan = getCurrentPlan();
  const advancedViews = hasFeature(plan, 'ADVANCED_CALENDAR_VIEWS');
  const customerDiscountEnabled = hasFeature(plan, 'CUSTOMER_DISCOUNT');
  const pricingOptions = useMemo(() => ({
    allowWeekly: hasFeature(plan, 'WEEKLY_PRICING'),
    allowMonthly: hasFeature(plan, 'MONTHLY_PRICING'),
    allowLongTermDiscount: hasFeature(plan, 'LONG_TERM_DISCOUNT'),
  }), [plan]);

  const [view, setView] = useState<CalendarView>('MONTH');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationItems, setReservationItems] = useState<ReservationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<ReservationForm>(blankForm);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [weekCursor, setWeekCursor] = useState(() => startOfWeek(new Date()));
  const [availabilityStart, setAvailabilityStart] = useState('');
  const [availabilityEnd, setAvailabilityEnd] = useState('');
  const [availabilityBefore, setAvailabilityBefore] = useState('0');
  const [availabilityAfter, setAvailabilityAfter] = useState('0');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [assetResult, customerResult, reservationResult, itemResult] = await Promise.all([
        items.query(ASSETS).limit(1000).find(),
        items.query(CUSTOMERS).limit(1000).find(),
        items.query(RESERVATIONS).limit(1000).find(),
        items.query(RESERVATION_ITEMS).limit(1000).find(),
      ]);
      setAssets(assetResult.items as Asset[]);
      setCustomers(customerResult.items as Customer[]);
      setReservations(reservationResult.items as Reservation[]);
      setReservationItems(itemResult.items as ReservationItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les réservations.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeAssets = useMemo(() => assets.filter((asset) => asset.active !== false && asset.status !== 'INACTIVE'), [assets]);
  const activeCustomers = useMemo(() => customers.filter((customer) => customer.active !== false).sort((a, b) => customerName(a).localeCompare(customerName(b), 'fr')), [customers]);
  const selectedCustomer = useMemo(() => activeCustomers.find((customer) => customer._id === form.customerId), [activeCustomers, form.customerId]);

  const isAvailable = useCallback((assetId: string, start: Date, end: Date, before: number, after: number) => {
    const requested = getBlockedRange(start, end, before, after);
    return !reservationItems.some((item) => {
      if (item.assetId !== assetId || item.status === 'CANCELLED' || item.status === 'COMPLETED') return false;
      const existingStart = asDate(item.blockedStartDateTime);
      const existingEnd = asDate(item.blockedEndDateTime);
      if (existingStart.getTime() === 0 || existingEnd.getTime() === 0) return false;
      return rangesOverlap(requested.blockedStart, requested.blockedEnd, existingStart, existingEnd);
    });
  }, [reservationItems]);

  const formDates = useMemo(() => {
    const start = form.startDateTime ? new Date(form.startDateTime) : null;
    const end = form.endDateTime ? new Date(form.endDateTime) : null;
    const valid = !!start && !!end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start;
    return { start, end, valid };
  }, [form.startDateTime, form.endDateTime]);

  const formAssetAvailability = useMemo(() => {
    if (!formDates.valid || !formDates.start || !formDates.end) return new Map<string, boolean>();
    const before = numberValue(form.bufferBeforeHours);
    const after = numberValue(form.bufferAfterHours);
    return new Map(activeAssets.map((asset) => [asset._id || '', !!asset._id && isAvailable(asset._id, formDates.start!, formDates.end!, before, after)]));
  }, [activeAssets, formDates, form.bufferBeforeHours, form.bufferAfterHours, isAvailable]);

  const priceLines = useMemo(() => {
    if (!formDates.valid || !formDates.start || !formDates.end) return [];
    return selectedAssetIds.flatMap((id) => {
      const asset = activeAssets.find((candidate) => candidate._id === id);
      if (!asset) return [];
      try { return [{ asset, ...calculateRentalPrice(asset, formDates.start, formDates.end, pricingOptions) }]; }
      catch { return []; }
    });
  }, [activeAssets, formDates, pricingOptions, selectedAssetIds]);

  const subtotalCents = priceLines.reduce((sum, line) => sum + line.totalCents, 0);
  const customerDiscountPercent = customerDiscountEnabled && form.customerMode === 'EXISTING' ? selectedCustomer?.discountPercent || 0 : 0;
  const customerDiscountCents = Math.round(subtotalCents * customerDiscountPercent / 100);
  const totalCents = Math.max(0, subtotalCents - customerDiscountCents);
  const currency = priceLines[0]?.asset.currency || 'CAD';

  const openForm = () => {
    setForm(blankForm); setSelectedAssetIds([]); setFormError(''); setSuccess(''); setFormOpen(true);
  };
  const toggleAsset = (id: string) => setSelectedAssetIds((current) => current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]);

  const saveReservation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(''); setSuccess('');
    if (!formDates.valid || !formDates.start || !formDates.end) return setFormError('La période de location est invalide.');
    if (selectedAssetIds.length === 0) return setFormError('Sélectionnez au moins un équipement.');
    if (form.customerMode === 'EXISTING' && !selectedCustomer?._id) return setFormError('Sélectionnez un client.');
    if (form.customerMode === 'NEW' && !form.newFirstName.trim() && !form.newLastName.trim() && !form.newCompanyName.trim()) return setFormError('Entrez le nom du nouveau client.');

    const before = numberValue(form.bufferBeforeHours);
    const after = numberValue(form.bufferAfterHours);
    setSaving(true);
    let createdReservation: Reservation | null = null;

    try {
      const latestItemsResult = await items.query(RESERVATION_ITEMS).limit(1000).find();
      const latestItems = latestItemsResult.items as ReservationItem[];
      const requested = getBlockedRange(formDates.start, formDates.end, before, after);
      for (const assetId of selectedAssetIds) {
        const conflict = latestItems.some((item) => item.assetId === assetId && item.status !== 'CANCELLED' && item.status !== 'COMPLETED' && rangesOverlap(requested.blockedStart, requested.blockedEnd, asDate(item.blockedStartDateTime), asDate(item.blockedEndDateTime)));
        if (conflict) throw new Error(`${activeAssets.find((asset) => asset._id === assetId)?.title || 'Un équipement'} n’est plus disponible pour cette période.`);
      }

      let customer: Customer;
      if (form.customerMode === 'EXISTING' && selectedCustomer) {
        customer = selectedCustomer;
      } else {
        const email = form.newEmail.trim().toLowerCase();
        if (email && customers.some((candidate) => candidate.email?.trim().toLowerCase() === email)) throw new Error('Un client avec ce courriel existe déjà. Sélectionnez-le dans la liste des clients existants.');
        customer = await items.insert(CUSTOMERS, {
          customerNumber: customerNumber(),
          firstName: form.newFirstName.trim(),
          lastName: form.newLastName.trim(),
          companyName: form.newCompanyName.trim(),
          email,
          phone: form.newPhone.trim(),
          discountPercent: 0,
          active: true,
        }) as Customer;
      }
      if (!customer._id) throw new Error('Wix n’a pas retourné l’identifiant du client.');

      const number = reservationNumber();
      const name = customerName(customer);
      const appliedDiscountPercent = customerDiscountEnabled ? customer.discountPercent || 0 : 0;
      const discountCents = Math.round(subtotalCents * appliedDiscountPercent / 100);
      const finalTotal = Math.max(0, subtotalCents - discountCents);

      createdReservation = await items.insert(RESERVATIONS, {
        reservationNumber: number,
        customerId: customer._id,
        customerNumber: customer.customerNumber || '',
        customerName: name,
        customerEmail: customer.email || '',
        customerPhone: customer.phone || '',
        startDateTime: formDates.start,
        endDateTime: formDates.end,
        bufferBeforeHours: before,
        bufferAfterHours: after,
        status: 'CONFIRMED',
        subtotalCents,
        customerDiscountPercent: appliedDiscountPercent,
        discountCents,
        totalCents: finalTotal,
        currency,
        notes: form.notes.trim(),
      }) as Reservation;

      if (!createdReservation._id) throw new Error('Wix n’a pas retourné l’identifiant de la réservation.');
      for (const line of priceLines) {
        if (!line.asset._id) continue;
        await items.insert(RESERVATION_ITEMS, {
          reservationId: createdReservation._id,
          reservationNumber: number,
          assetId: line.asset._id,
          assetNumber: line.asset.assetNumber || '',
          assetTitle: line.asset.title || '',
          startDateTime: formDates.start,
          endDateTime: formDates.end,
          blockedStartDateTime: requested.blockedStart,
          blockedEndDateTime: requested.blockedEnd,
          bufferBeforeHours: before,
          bufferAfterHours: after,
          billableDays: line.billableDays,
          lineTotalCents: line.totalCents,
          pricingMode: line.pricingMode,
          currency: line.asset.currency || currency,
          status: 'CONFIRMED',
        });
      }

      setFormOpen(false);
      setSuccess(`Réservation ${number} créée pour ${name}.`);
      await load();
    } catch (e) {
      if (createdReservation?._id) {
        try { await items.update(RESERVATIONS, { ...createdReservation, status: 'ERROR' }); } catch { /* preserve original error */ }
      }
      setFormError(e instanceof Error ? e.message : 'Impossible de créer la réservation.');
    } finally { setSaving(false); }
  };

  const cancelReservation = async (reservation: Reservation) => {
    if (!reservation._id || reservation.status === 'CANCELLED') return;
    if (!window.confirm(`Annuler la réservation ${reservation.reservationNumber || ''} ?`)) return;
    setError(''); setSuccess('');
    try {
      await items.update(RESERVATIONS, { ...reservation, status: 'CANCELLED' });
      for (const item of reservationItems.filter((candidate) => candidate.reservationId === reservation._id)) {
        if (item._id) await items.update(RESERVATION_ITEMS, { ...item, status: 'CANCELLED' });
      }
      setSuccess(`Réservation ${reservation.reservationNumber || ''} annulée. Les équipements sont de nouveau disponibles.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d’annuler la réservation.'); }
  };

  const sortedReservations = useMemo(() => [...reservations].sort((a, b) => asDate(a.startDateTime).getTime() - asDate(b.startDateTime).getTime()), [reservations]);
  const monthReservations = useMemo(() => sortedReservations.filter((reservation) => { const d = asDate(reservation.startDateTime); return d.getFullYear() === monthCursor.getFullYear() && d.getMonth() === monthCursor.getMonth(); }), [monthCursor, sortedReservations]);
  const weekEnd = useMemo(() => new Date(weekCursor.getTime() + 7 * 24 * 60 * 60 * 1000), [weekCursor]);
  const weekReservations = useMemo(() => sortedReservations.filter((reservation) => { const d = asDate(reservation.startDateTime); return d >= weekCursor && d < weekEnd; }), [sortedReservations, weekCursor, weekEnd]);

  const availabilityResult = useMemo(() => {
    if (!availabilityStart || !availabilityEnd) return null;
    const start = new Date(availabilityStart); const end = new Date(availabilityEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
    const before = numberValue(availabilityBefore); const after = numberValue(availabilityAfter);
    return activeAssets.map((asset) => ({ asset, available: !!asset._id && isAvailable(asset._id, start, end, before, after) }));
  }, [activeAssets, availabilityAfter, availabilityBefore, availabilityEnd, availabilityStart, isAvailable]);

  const selectView = (next: CalendarView) => {
    if ((next === 'WEEK' || next === 'AVAILABILITY') && !advancedViews) return;
    setView(next);
  };

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header title="Calendrier / Réservations" subtitle="Planifiez les locations, appliquez vos buffers et liez chaque réservation à un client." />
        <Page.Content>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <ViewButton active={view === 'MONTH'} onClick={() => selectView('MONTH')}>Mois</ViewButton>
                <ViewButton active={view === 'WEEK'} locked={!advancedViews} onClick={() => selectView('WEEK')}>Semaine</ViewButton>
                <ViewButton active={view === 'LIST'} onClick={() => selectView('LIST')}>Liste</ViewButton>
                <ViewButton active={view === 'AVAILABILITY'} locked={!advancedViews} onClick={() => selectView('AVAILABILITY')}>Disponibilité</ViewButton>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ color: '#64748b', fontSize: 13 }}>Plan : <strong>{planLabels[plan]}</strong></span><button style={primary} onClick={openForm}>+ Nouvelle réservation</button></div>
            </div>

            {success && <div style={{ ...card, background: '#f0fdf4', borderColor: '#86efac', color: '#166534' }}>{success}</div>}
            {error && <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>{error}</div>}

            {loading ? <div style={card}>Chargement…</div> : <>
              {view === 'MONTH' && <div style={card}><CalendarHeader title={new Intl.DateTimeFormat('fr-CA', { month: 'long', year: 'numeric' }).format(monthCursor)} onPrevious={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))} onNext={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))} /><ReservationCards reservations={monthReservations} reservationItems={reservationItems} onCancel={cancelReservation} /></div>}
              {view === 'WEEK' && <div style={card}><CalendarHeader title={`${new Intl.DateTimeFormat('fr-CA', { month: 'short', day: 'numeric' }).format(weekCursor)} au ${new Intl.DateTimeFormat('fr-CA', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(weekEnd.getTime() - 1))}`} onPrevious={() => setWeekCursor(new Date(weekCursor.getTime() - 7 * 86400000))} onNext={() => setWeekCursor(new Date(weekCursor.getTime() + 7 * 86400000))} /><ReservationCards reservations={weekReservations} reservationItems={reservationItems} onCancel={cancelReservation} /></div>}
              {view === 'LIST' && <div style={card}><h2 style={{ marginTop: 0 }}>Toutes les réservations</h2><ReservationCards reservations={sortedReservations} reservationItems={reservationItems} onCancel={cancelReservation} /></div>}
              {view === 'AVAILABILITY' && <div style={card}>
                <h2 style={{ marginTop: 0 }}>Recherche de disponibilité</h2><p style={{ color: '#64748b' }}>Le buffer bloque l’équipement avant/après la location sans être facturé.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
                  <Field label="Début"><input type="datetime-local" style={input} value={availabilityStart} onChange={(e) => setAvailabilityStart(e.target.value)} /></Field>
                  <Field label="Fin"><input type="datetime-local" style={input} value={availabilityEnd} onChange={(e) => setAvailabilityEnd(e.target.value)} /></Field>
                  <Field label="Buffer avant (h)"><input type="number" min="0" step="0.5" style={input} value={availabilityBefore} onChange={(e) => setAvailabilityBefore(e.target.value)} /></Field>
                  <Field label="Buffer après (h)"><input type="number" min="0" step="0.5" style={input} value={availabilityAfter} onChange={(e) => setAvailabilityAfter(e.target.value)} /></Field>
                </div>
                <div style={{ marginTop: 20 }}>{!availabilityResult ? <div style={{ color: '#64748b' }}>Choisissez une période valide.</div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>{availabilityResult.map(({ asset, available }) => <div key={asset._id || asset.assetNumber} style={{ border: `1px solid ${available ? '#86efac' : '#fecaca'}`, background: available ? '#f0fdf4' : '#fef2f2', borderRadius: 10, padding: 14 }}><strong>{asset.title || 'Sans nom'}</strong><div style={{ color: '#64748b', marginTop: 4 }}>{asset.assetNumber || '—'}</div><div style={{ marginTop: 8, fontWeight: 700, color: available ? '#166534' : '#991b1b' }}>{available ? 'Disponible' : 'Indisponible'}</div></div>)}</div>}</div>
              </div>}
            </>}
          </div>
        </Page.Content>
      </Page>

      {formOpen && <div onMouseDown={() => !saving && setFormOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
        <div onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 960, maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 14 }}>
          <form onSubmit={saveReservation}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}><div><h2 style={{ margin: 0 }}>Nouvelle réservation</h2><div style={{ color: '#64748b', marginTop: 4 }}>Client, disponibilité, tarification et buffers dans un même flux.</div></div><button type="button" onClick={() => !saving && setFormOpen(false)} style={{ border: 0, background: 'transparent', fontSize: 26 }}>×</button></div>
            <div style={{ padding: 24 }}>
              {formError && <div style={{ background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: 12, marginBottom: 18 }}>{formError}</div>}

              <h3 style={{ marginTop: 0 }}>Client</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}><button type="button" style={{ ...secondary, background: form.customerMode === 'EXISTING' ? '#116dff' : '#fff', color: form.customerMode === 'EXISTING' ? '#fff' : '#116dff' }} onClick={() => setForm({ ...form, customerMode: 'EXISTING' })}>Client existant</button><button type="button" style={{ ...secondary, background: form.customerMode === 'NEW' ? '#116dff' : '#fff', color: form.customerMode === 'NEW' ? '#fff' : '#116dff' }} onClick={() => setForm({ ...form, customerMode: 'NEW', customerId: '' })}>Nouveau client</button></div>

              {form.customerMode === 'EXISTING' ? <div>
                <Field label="Choisir un client *"><select style={input} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">Sélectionner…</option>{activeCustomers.map((customer) => <option key={customer._id} value={customer._id}>{customerName(customer)}{customer.companyName && (customer.firstName || customer.lastName) ? ` · ${customer.companyName}` : ''} · {customer.customerNumber || ''}</option>)}</select></Field>
                {selectedCustomer && <div style={{ ...card, marginTop: 12, padding: 14, background: '#f8fafc' }}><strong>{customerName(selectedCustomer)}</strong><div style={{ color: '#64748b', marginTop: 4 }}>{selectedCustomer.email || 'Aucun courriel'} · {selectedCustomer.phone || 'Aucun téléphone'}</div><div style={{ marginTop: 6 }}>Rabais client : <strong>{customerDiscountEnabled ? `${selectedCustomer.discountPercent || 0} %` : '🔒 Business'}</strong></div></div>}
              </div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14 }}>
                <Field label="Prénom"><input style={input} value={form.newFirstName} onChange={(e) => setForm({ ...form, newFirstName: e.target.value })} /></Field>
                <Field label="Nom"><input style={input} value={form.newLastName} onChange={(e) => setForm({ ...form, newLastName: e.target.value })} /></Field>
                <Field label="Entreprise"><input style={input} value={form.newCompanyName} onChange={(e) => setForm({ ...form, newCompanyName: e.target.value })} /></Field>
                <Field label="Courriel"><input type="email" style={input} value={form.newEmail} onChange={(e) => setForm({ ...form, newEmail: e.target.value })} /></Field>
                <Field label="Téléphone"><input style={input} value={form.newPhone} onChange={(e) => setForm({ ...form, newPhone: e.target.value })} /></Field>
              </div>}

              <h3 style={{ marginTop: 24 }}>Période de location</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
                <Field label="Début *"><input type="datetime-local" style={input} value={form.startDateTime} onChange={(e) => setForm({ ...form, startDateTime: e.target.value })} /></Field>
                <Field label="Fin *"><input type="datetime-local" style={input} value={form.endDateTime} onChange={(e) => setForm({ ...form, endDateTime: e.target.value })} /></Field>
                <Field label="Buffer avant (heures)"><input type="number" min="0" step="0.5" style={input} value={form.bufferBeforeHours} onChange={(e) => setForm({ ...form, bufferBeforeHours: e.target.value })} /></Field>
                <Field label="Buffer après (heures)"><input type="number" min="0" step="0.5" style={input} value={form.bufferAfterHours} onChange={(e) => setForm({ ...form, bufferAfterHours: e.target.value })} /></Field>
              </div>

              <h3 style={{ marginTop: 24 }}>Équipements</h3>
              {!formDates.valid ? <div style={{ color: '#64748b' }}>Choisissez d’abord une période valide.</div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))', gap: 12 }}>{activeAssets.map((asset) => {
                const id = asset._id || ''; const available = formAssetAvailability.get(id) === true; const selected = selectedAssetIds.includes(id);
                return <label key={id || asset.assetNumber} style={{ border: `1px solid ${selected ? '#116dff' : '#e5e7eb'}`, borderRadius: 10, padding: 14, opacity: available ? 1 : .55, cursor: available ? 'pointer' : 'not-allowed', background: selected ? '#eff6ff' : '#fff' }}><div style={{ display: 'flex', gap: 10 }}><input type="checkbox" checked={selected} disabled={!available} onChange={() => available && toggleAsset(id)} /><div><strong>{asset.title || 'Sans nom'}</strong><div style={{ color: '#64748b', marginTop: 3 }}>{asset.assetNumber || '—'} · {asset.productType || 'Équipement'}</div><div style={{ marginTop: 6, color: available ? '#166534' : '#991b1b', fontWeight: 600 }}>{available ? 'Disponible' : 'Conflit avec réservation/buffer'}</div></div></div></label>;
              })}</div>}

              {priceLines.length > 0 && <div style={{ ...card, marginTop: 20, background: '#f8fafc' }}><h3 style={{ marginTop: 0 }}>Tarification</h3>{priceLines.map((line) => <div key={line.asset._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid #e5e7eb' }}><span>{line.asset.title} · {line.billableDays} jour(s) · {line.pricingMode}</span><strong>{money(line.totalCents, line.asset.currency || currency)}</strong></div>)}<div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}><span>Sous-total</span><strong>{money(subtotalCents, currency)}</strong></div>{customerDiscountPercent > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, color: '#166534' }}><span>Rabais client ({customerDiscountPercent} %)</span><strong>- {money(customerDiscountCents, currency)}</strong></div>}<div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 18 }}><strong>Total</strong><strong>{money(totalCents, currency)}</strong></div></div>}

              <div style={{ marginTop: 20 }}><Field label="Notes"><textarea style={{ ...input, minHeight: 90 }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button type="button" style={secondary} onClick={() => !saving && setFormOpen(false)} disabled={saving}>Annuler</button><button type="submit" style={primary} disabled={saving}>{saving ? 'Création…' : 'Créer la réservation'}</button></div>
          </form>
        </div>
      </div>}
    </WixDesignSystemProvider>
  );
};

const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => <label style={{ display: 'block' }}><span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</span>{children}</label>;
const ViewButton: FC<{ active: boolean; locked?: boolean; onClick: () => void; children: string }> = ({ active, locked, onClick, children }) => <button onClick={onClick} title={locked ? 'Plan Business requis' : undefined} style={{ ...secondary, background: active ? '#116dff' : '#fff', color: active ? '#fff' : locked ? '#94a3b8' : '#116dff', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? .65 : 1 }}>{locked ? '🔒 ' : ''}{children}</button>;
const CalendarHeader: FC<{ title: string; onPrevious: () => void; onNext: () => void }> = ({ title, onPrevious, onNext }) => <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}><button style={secondary} onClick={onPrevious}>‹</button><h2 style={{ margin: 0, textTransform: 'capitalize' }}>{title}</h2><button style={secondary} onClick={onNext}>›</button></div>;

const ReservationCards: FC<{ reservations: Reservation[]; reservationItems: ReservationItem[]; onCancel: (reservation: Reservation) => void }> = ({ reservations, reservationItems, onCancel }) => {
  if (reservations.length === 0) return <div style={{ padding: 36, textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 10 }}>Aucune réservation dans cette période.</div>;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{reservations.map((reservation) => {
    const linked = reservationItems.filter((item) => item.reservationId === reservation._id);
    const cancelled = reservation.status === 'CANCELLED';
    return <div key={reservation._id || reservation.reservationNumber} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 15, opacity: cancelled ? .55 : 1 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}><div><div style={{ fontWeight: 700 }}>{reservation.reservationNumber || 'Réservation'} · {reservation.customerName || 'Client'}</div><div style={{ color: '#64748b', marginTop: 4 }}>{reservation.customerNumber || ''}{reservation.customerEmail ? ` · ${reservation.customerEmail}` : ''}</div><div style={{ color: '#64748b', marginTop: 4 }}>{dateTime(reservation.startDateTime)} → {dateTime(reservation.endDateTime)}</div><div style={{ color: '#64748b', marginTop: 4 }}>{linked.map((item) => item.assetTitle || item.assetNumber).filter(Boolean).join(', ') || 'Aucun équipement'}</div><div style={{ color: '#64748b', marginTop: 4 }}>Buffer : {reservation.bufferBeforeHours || 0} h avant · {reservation.bufferAfterHours || 0} h après</div></div><div style={{ textAlign: 'right' }}>{(reservation.discountCents || 0) > 0 && <div style={{ color: '#166534', fontSize: 13 }}>Rabais : -{money(reservation.discountCents, reservation.currency || 'CAD')}</div>}<div style={{ fontWeight: 700, fontSize: 18 }}>{money(reservation.totalCents, reservation.currency || 'CAD')}</div><div style={{ marginTop: 5, fontSize: 13, fontWeight: 700, color: cancelled ? '#991b1b' : '#166534' }}>{reservation.status || 'CONFIRMED'}</div>{!cancelled && reservation.status !== 'COMPLETED' && <button style={{ ...secondary, marginTop: 8, padding: '6px 10px' }} onClick={() => onCancel(reservation)}>Annuler</button>}</div></div></div>;
  })}</div>;
};

export default ReservationsPage;
