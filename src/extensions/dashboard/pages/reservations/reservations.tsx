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
const DOCUMENTS = '@pilotedavid1/rental-flow/documents';
const PAYMENTS = '@pilotedavid1/rental-flow/payments';
const INSPECTIONS = '@pilotedavid1/rental-flow/inspections';
const ACTIVITY = '@pilotedavid1/rental-flow/activity-log';

type CalendarView = 'MONTH' | 'WEEK' | 'LIST' | 'AVAILABILITY';
type ReservationStatus = 'CONFIRMED' | 'RENTED' | 'RETURNED' | 'CANCELLED' | 'COMPLETED' | 'ERROR';
type CustomerMode = 'EXISTING' | 'NEW';
type DetailTab = 'DETAILS' | 'EQUIPMENT' | 'PAYMENTS' | 'DOCUMENTS' | 'INSPECTION' | 'NOTES' | 'HISTORY';
type WorkflowStage = 'RESERVATION' | 'QUOTE' | 'CONTRACT' | 'INVOICE' | 'PAYMENT' | 'READY' | 'RENTED' | 'RETURNED' | 'COMPLETED';
type DocumentType = 'QUOTE' | 'CONTRACT' | 'INVOICE';
type PaymentType = 'PAYMENT' | 'SECURITY_DEPOSIT' | 'REFUND' | 'DEPOSIT_REFUND' | 'DAMAGE_CHARGE';
type InspectionType = 'DEPARTURE' | 'RETURN';

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
  workflowStage?: WorkflowStage; subtotalCents?: number; customerDiscountPercent?: number;
  discountCents?: number; totalCents?: number; currency?: string;
  checkoutDateTime?: Date | string; returnDateTime?: Date | string; closedDateTime?: Date | string;
  notes?: string; _createdDate?: Date | string; _updatedDate?: Date | string;
};

type ReservationItem = {
  _id?: string; reservationId?: string; reservationNumber?: string; assetId?: string;
  assetNumber?: string; assetTitle?: string; startDateTime?: Date | string; endDateTime?: Date | string;
  blockedStartDateTime?: Date | string; blockedEndDateTime?: Date | string;
  bufferBeforeHours?: number; bufferAfterHours?: number; billableDays?: number;
  lineTotalCents?: number; pricingMode?: string; currency?: string; status?: ReservationStatus;
};

type RentalDocument = {
  _id?: string; reservationId?: string; reservationNumber?: string; documentNumber?: string;
  documentType?: DocumentType; status?: string; amountCents?: number; currency?: string;
  issuedDate?: Date | string; sentDate?: Date | string; acceptedDate?: Date | string;
  signedDate?: Date | string; dueDate?: Date | string; signerName?: string; pdfUrl?: string;
  notes?: string; _createdDate?: Date | string;
};

type Payment = {
  _id?: string; reservationId?: string; reservationNumber?: string; paymentNumber?: string;
  paymentType?: PaymentType; method?: string; status?: string; amountCents?: number; currency?: string;
  paymentDate?: Date | string; reference?: string; notes?: string; _createdDate?: Date | string;
};

type Inspection = {
  _id?: string; reservationId?: string; reservationNumber?: string; inspectionNumber?: string;
  inspectionType?: InspectionType; status?: string; assetId?: string; assetNumber?: string;
  assetTitle?: string; condition?: string; hasDamage?: boolean; damageDescription?: string;
  damageAmountCents?: number; photoUrls?: string; signerName?: string; inspectionDate?: Date | string;
  notes?: string; _createdDate?: Date | string;
};

type ActivityEntry = {
  _id?: string; reservationId?: string; reservationNumber?: string; actionType?: string;
  description?: string; actor?: string; eventDate?: Date | string; _createdDate?: Date | string;
};

type ReservationForm = {
  customerMode: CustomerMode; customerId: string; newFirstName: string; newLastName: string;
  newCompanyName: string; newEmail: string; newPhone: string; startDateTime: string; endDateTime: string;
  bufferBeforeHours: string; bufferAfterHours: string; notes: string;
};

type PaymentForm = {
  paymentType: PaymentType; method: string; status: string; amount: string; reference: string; notes: string;
};

type InspectionForm = {
  inspectionType: InspectionType; assetId: string; condition: string; hasDamage: boolean;
  damageDescription: string; damageAmount: string; photoUrls: string; signerName: string; notes: string;
};

const blankForm: ReservationForm = {
  customerMode: 'EXISTING', customerId: '', newFirstName: '', newLastName: '', newCompanyName: '',
  newEmail: '', newPhone: '', startDateTime: '', endDateTime: '', bufferBeforeHours: '0', bufferAfterHours: '0', notes: '',
};
const blankPayment: PaymentForm = {
  paymentType: 'PAYMENT', method: 'CARD', status: 'PAID', amount: '', reference: '', notes: '',
};
const blankInspection: InspectionForm = {
  inspectionType: 'DEPARTURE', assetId: '', condition: 'GOOD', hasDamage: false,
  damageDescription: '', damageAmount: '', photoUrls: '', signerName: '', notes: '',
};

const card: CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.06)' };
const primary: CSSProperties = { border: 0, borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', background: '#116dff', color: '#fff' };
const secondary: CSSProperties = { ...primary, border: '1px solid #116dff', background: '#fff', color: '#116dff' };
const danger: CSSProperties = { ...secondary, borderColor: '#dc2626', color: '#b91c1c' };
const successButton: CSSProperties = { ...secondary, borderColor: '#16a34a', color: '#15803d' };
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px', fontSize: 14, background: '#fff' };

const stageRank: WorkflowStage[] = ['RESERVATION', 'QUOTE', 'CONTRACT', 'INVOICE', 'PAYMENT', 'READY', 'RENTED', 'RETURNED', 'COMPLETED'];
const stageLabels: Record<WorkflowStage, string> = {
  RESERVATION: 'Réservation', QUOTE: 'Devis', CONTRACT: 'Contrat', INVOICE: 'Facture',
  PAYMENT: 'Paiement', READY: 'Prêt au départ', RENTED: 'En location', RETURNED: 'Retourné', COMPLETED: 'Clôturé',
};
const documentLabels: Record<DocumentType, string> = { QUOTE: 'Devis', CONTRACT: 'Contrat', INVOICE: 'Facture' };
const paymentLabels: Record<PaymentType, string> = {
  PAYMENT: 'Paiement', SECURITY_DEPOSIT: 'Dépôt de sécurité', REFUND: 'Remboursement',
  DEPOSIT_REFUND: 'Remboursement dépôt', DAMAGE_CHARGE: 'Frais de dommage',
};

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
function cents(value: string): number {
  return Math.round(numberValue(value) * 100);
}
function generatedNumber(prefix: string): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `${prefix}-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
}
function customerName(customer: Customer): string {
  const person = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  return person || customer.companyName || 'Client sans nom';
}
function startOfWeek(date: Date): Date {
  const result = new Date(date); const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1); result.setHours(0, 0, 0, 0); return result;
}
function safeStage(value?: WorkflowStage): WorkflowStage { return value && stageRank.includes(value) ? value : 'RESERVATION'; }
function maxStage(current: WorkflowStage | undefined, requested: WorkflowStage): WorkflowStage {
  return stageRank.indexOf(safeStage(current)) >= stageRank.indexOf(requested) ? safeStage(current) : requested;
}
function reservationPayload(reservation: Reservation, changes: Partial<Reservation> = {}) {
  return {
    _id: reservation._id,
    reservationNumber: reservation.reservationNumber || '', customerId: reservation.customerId || '',
    customerNumber: reservation.customerNumber || '', customerName: reservation.customerName || '',
    customerEmail: reservation.customerEmail || '', customerPhone: reservation.customerPhone || '',
    startDateTime: reservation.startDateTime, endDateTime: reservation.endDateTime,
    bufferBeforeHours: reservation.bufferBeforeHours || 0, bufferAfterHours: reservation.bufferAfterHours || 0,
    status: reservation.status || 'CONFIRMED', workflowStage: safeStage(reservation.workflowStage),
    subtotalCents: reservation.subtotalCents || 0, customerDiscountPercent: reservation.customerDiscountPercent || 0,
    discountCents: reservation.discountCents || 0, totalCents: reservation.totalCents || 0,
    currency: reservation.currency || 'CAD', checkoutDateTime: reservation.checkoutDateTime,
    returnDateTime: reservation.returnDateTime, closedDateTime: reservation.closedDateTime,
    notes: reservation.notes || '', ...changes,
  };
}
function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] || char));
}

const ReservationsPage: FC = () => {
  const plan = getCurrentPlan();
  const advancedViews = hasFeature(plan, 'ADVANCED_CALENDAR_VIEWS');
  const customerDiscountEnabled = hasFeature(plan, 'CUSTOMER_DISCOUNT');
  const documentsEnabled = hasFeature(plan, 'DOCUMENTS');
  const paymentsEnabled = hasFeature(plan, 'PAYMENTS');
  const inspectionsEnabled = hasFeature(plan, 'INSPECTIONS');
  const historyEnabled = hasFeature(plan, 'FULL_HISTORY');
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
  const [documents, setDocuments] = useState<RentalDocument[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<ReservationForm>(blankForm);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('DETAILS');
  const [notesDraft, setNotesDraft] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(blankPayment);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [inspectionForm, setInspectionForm] = useState<InspectionForm>(blankInspection);
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [weekCursor, setWeekCursor] = useState(() => startOfWeek(new Date()));
  const [availabilityStart, setAvailabilityStart] = useState('');
  const [availabilityEnd, setAvailabilityEnd] = useState('');
  const [availabilityBefore, setAvailabilityBefore] = useState('0');
  const [availabilityAfter, setAvailabilityAfter] = useState('0');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [assetResult, customerResult, reservationResult, itemResult, documentResult, paymentResult, inspectionResult, activityResult] = await Promise.all([
        items.query(ASSETS).limit(1000).find(), items.query(CUSTOMERS).limit(1000).find(),
        items.query(RESERVATIONS).limit(1000).find(), items.query(RESERVATION_ITEMS).limit(1000).find(),
        items.query(DOCUMENTS).limit(1000).find(), items.query(PAYMENTS).limit(1000).find(),
        items.query(INSPECTIONS).limit(1000).find(), items.query(ACTIVITY).limit(1000).find(),
      ]);
      setAssets(assetResult.items as Asset[]); setCustomers(customerResult.items as Customer[]);
      setReservations(reservationResult.items as Reservation[]); setReservationItems(itemResult.items as ReservationItem[]);
      setDocuments(documentResult.items as RentalDocument[]); setPayments(paymentResult.items as Payment[]);
      setInspections(inspectionResult.items as Inspection[]); setActivity(activityResult.items as ActivityEntry[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les réservations.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const logEvent = useCallback(async (reservation: Reservation, actionType: string, description: string) => {
    if (!reservation._id) return;
    try {
      const created = await items.insert(ACTIVITY, {
        reservationId: reservation._id, reservationNumber: reservation.reservationNumber || '',
        actionType, description, actor: 'Utilisateur Wix', eventDate: new Date(),
      }) as ActivityEntry;
      setActivity((current) => [...current, created]);
    } catch {
      // Le journal ne doit jamais bloquer l'opération principale.
    }
  }, []);

  const activeAssets = useMemo(() => assets.filter((asset) => asset.active !== false && asset.status !== 'INACTIVE'), [assets]);
  const activeCustomers = useMemo(() => customers.filter((customer) => customer.active !== false).sort((a, b) => customerName(a).localeCompare(customerName(b), 'fr')), [customers]);
  const selectedCustomer = useMemo(() => activeCustomers.find((customer) => customer._id === form.customerId), [activeCustomers, form.customerId]);

  const isAvailable = useCallback((assetId: string, start: Date, end: Date, before: number, after: number) => {
    const requested = getBlockedRange(start, end, before, after);
    return !reservationItems.some((item) => {
      if (item.assetId !== assetId || item.status === 'CANCELLED' || item.status === 'COMPLETED' || item.status === 'RETURNED') return false;
      const existingStart = asDate(item.blockedStartDateTime); const existingEnd = asDate(item.blockedEndDateTime);
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
    const before = numberValue(form.bufferBeforeHours); const after = numberValue(form.bufferAfterHours);
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

  const openForm = () => { setForm(blankForm); setSelectedAssetIds([]); setFormError(''); setSuccess(''); setFormOpen(true); };
  const toggleAsset = (id: string) => setSelectedAssetIds((current) => current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]);
  const openReservation = (reservation: Reservation) => {
    setSelectedReservation(reservation); setNotesDraft(reservation.notes || ''); setDetailTab('DETAILS'); setSuccess(''); setError('');
  };

  const updateReservation = useCallback(async (reservation: Reservation, changes: Partial<Reservation>, actionType?: string, description?: string) => {
    const updated = await items.update(RESERVATIONS, reservationPayload(reservation, changes)) as Reservation;
    setReservations((current) => current.map((entry) => entry._id === updated._id ? updated : entry));
    setSelectedReservation((current) => current?._id === updated._id ? updated : current);
    if (actionType && description) await logEvent(updated, actionType, description);
    return updated;
  }, [logEvent]);

  const updateLinkedItemsStatus = async (reservationId: string, status: ReservationStatus) => {
    const linked = reservationItems.filter((entry) => entry.reservationId === reservationId);
    for (const entry of linked) {
      if (!entry._id) continue;
      const updated = await items.update(RESERVATION_ITEMS, { ...entry, status }) as ReservationItem;
      setReservationItems((current) => current.map((candidate) => candidate._id === updated._id ? updated : candidate));
    }
  };

  const saveReservation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(''); setSuccess('');
    if (!formDates.valid || !formDates.start || !formDates.end) return setFormError('La période de location est invalide.');
    if (selectedAssetIds.length === 0) return setFormError('Sélectionnez au moins un équipement.');
    if (form.customerMode === 'EXISTING' && !selectedCustomer?._id) return setFormError('Sélectionnez un client.');
    if (form.customerMode === 'NEW' && !form.newFirstName.trim() && !form.newLastName.trim() && !form.newCompanyName.trim()) return setFormError('Entrez le nom du nouveau client.');

    const before = numberValue(form.bufferBeforeHours); const after = numberValue(form.bufferAfterHours);
    setSaving(true); let createdReservation: Reservation | null = null;
    try {
      const latestItems = (await items.query(RESERVATION_ITEMS).limit(1000).find()).items as ReservationItem[];
      const requested = getBlockedRange(formDates.start, formDates.end, before, after);
      for (const assetId of selectedAssetIds) {
        const conflict = latestItems.some((entry) => entry.assetId === assetId && entry.status !== 'CANCELLED' && entry.status !== 'COMPLETED' && entry.status !== 'RETURNED' && rangesOverlap(requested.blockedStart, requested.blockedEnd, asDate(entry.blockedStartDateTime), asDate(entry.blockedEndDateTime)));
        if (conflict) throw new Error(`${activeAssets.find((asset) => asset._id === assetId)?.title || 'Un équipement'} n’est plus disponible pour cette période.`);
      }

      let customer: Customer;
      if (form.customerMode === 'EXISTING' && selectedCustomer) customer = selectedCustomer;
      else {
        const email = form.newEmail.trim().toLowerCase();
        if (email && customers.some((candidate) => candidate.email?.trim().toLowerCase() === email)) throw new Error('Un client avec ce courriel existe déjà. Sélectionnez-le dans la liste.');
        customer = await items.insert(CUSTOMERS, {
          customerNumber: generatedNumber('C'), firstName: form.newFirstName.trim(), lastName: form.newLastName.trim(),
          companyName: form.newCompanyName.trim(), email, phone: form.newPhone.trim(), discountPercent: 0, active: true,
        }) as Customer;
      }
      if (!customer._id) throw new Error('Wix n’a pas retourné l’identifiant du client.');

      const number = generatedNumber('RF'); const name = customerName(customer);
      const appliedDiscount = customerDiscountEnabled ? customer.discountPercent || 0 : 0;
      const discount = Math.round(subtotalCents * appliedDiscount / 100); const finalTotal = Math.max(0, subtotalCents - discount);

      createdReservation = await items.insert(RESERVATIONS, {
        reservationNumber: number, customerId: customer._id, customerNumber: customer.customerNumber || '',
        customerName: name, customerEmail: customer.email || '', customerPhone: customer.phone || '',
        startDateTime: formDates.start, endDateTime: formDates.end, bufferBeforeHours: before, bufferAfterHours: after,
        status: 'CONFIRMED', workflowStage: 'RESERVATION', subtotalCents, customerDiscountPercent: appliedDiscount,
        discountCents: discount, totalCents: finalTotal, currency, notes: form.notes.trim(),
      }) as Reservation;
      if (!createdReservation._id) throw new Error('Wix n’a pas retourné l’identifiant de la réservation.');

      for (const line of priceLines) {
        if (!line.asset._id) continue;
        const blocked = getBlockedRange(formDates.start, formDates.end, before, after);
        await items.insert(RESERVATION_ITEMS, {
          reservationId: createdReservation._id, reservationNumber: number, assetId: line.asset._id,
          assetNumber: line.asset.assetNumber || '', assetTitle: line.asset.title || '', startDateTime: formDates.start,
          endDateTime: formDates.end, blockedStartDateTime: blocked.blockedStart, blockedEndDateTime: blocked.blockedEnd,
          bufferBeforeHours: before, bufferAfterHours: after, billableDays: line.billableDays,
          lineTotalCents: line.totalCents, pricingMode: line.pricingMode, currency: line.asset.currency || currency, status: 'CONFIRMED',
        });
      }

      await logEvent(createdReservation, 'RESERVATION_CREATED', `Réservation ${number} créée pour ${name}.`);
      setFormOpen(false); setSuccess(`Réservation ${number} créée avec succès.`); await load();
    } catch (e) {
      if (createdReservation?._id) {
        try { await items.update(RESERVATIONS, reservationPayload(createdReservation, { status: 'ERROR' })); } catch { /* noop */ }
      }
      setFormError(e instanceof Error ? e.message : 'Impossible de créer la réservation.');
    } finally { setSaving(false); }
  };

  const cancelReservation = async (reservation: Reservation) => {
    if (!reservation._id || reservation.status === 'CANCELLED') return;
    if (!window.confirm(`Annuler la réservation ${reservation.reservationNumber || ''} ?`)) return;
    try {
      const updated = await updateReservation(reservation, { status: 'CANCELLED' }, 'RESERVATION_CANCELLED', 'Réservation annulée.');
      await updateLinkedItemsStatus(updated._id!, 'CANCELLED');
      setSuccess(`Réservation ${updated.reservationNumber || ''} annulée. Les équipements sont libérés.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d’annuler la réservation.'); }
  };

  const createDocument = async (type: DocumentType) => {
    if (!selectedReservation?._id || !documentsEnabled) return;
    setError(''); setSuccess('');
    try {
      const prefix = type === 'QUOTE' ? 'DEV' : type === 'CONTRACT' ? 'CTR' : 'FAC';
      const created = await items.insert(DOCUMENTS, {
        reservationId: selectedReservation._id, reservationNumber: selectedReservation.reservationNumber || '',
        documentNumber: generatedNumber(prefix), documentType: type, status: 'DRAFT',
        amountCents: selectedReservation.totalCents || 0, currency: selectedReservation.currency || 'CAD',
        issuedDate: new Date(), notes: '',
      }) as RentalDocument;
      setDocuments((current) => [...current, created]);
      const nextStage: WorkflowStage = type === 'QUOTE' ? 'QUOTE' : type === 'CONTRACT' ? 'CONTRACT' : 'INVOICE';
      await updateReservation(selectedReservation, { workflowStage: maxStage(selectedReservation.workflowStage, nextStage) });
      await logEvent(selectedReservation, 'DOCUMENT_CREATED', `${documentLabels[type]} ${created.documentNumber || ''} créé.`);
      setSuccess(`${documentLabels[type]} créé.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible de créer le document.'); }
  };

  const updateDocumentStatus = async (document: RentalDocument, status: string) => {
    if (!document._id || !selectedReservation) return;
    try {
      const now = new Date();
      const changes: Partial<RentalDocument> = { status };
      if (status === 'SENT' || status === 'ISSUED') changes.sentDate = now;
      if (status === 'ACCEPTED') changes.acceptedDate = now;
      if (status === 'SIGNED') {
        const signer = window.prompt('Nom du signataire :', selectedReservation.customerName || '')?.trim();
        if (!signer) return;
        changes.signedDate = now; changes.signerName = signer;
      }
      const updated = await items.update(DOCUMENTS, { ...document, ...changes }) as RentalDocument;
      setDocuments((current) => current.map((entry) => entry._id === updated._id ? updated : entry));
      let nextStage = selectedReservation.workflowStage;
      if (document.documentType === 'QUOTE' && status === 'ACCEPTED') nextStage = maxStage(nextStage, 'CONTRACT');
      if (document.documentType === 'CONTRACT' && status === 'SIGNED') nextStage = maxStage(nextStage, 'INVOICE');
      if (document.documentType === 'INVOICE' && (status === 'ISSUED' || status === 'SENT')) nextStage = maxStage(nextStage, 'PAYMENT');
      if (nextStage !== selectedReservation.workflowStage) await updateReservation(selectedReservation, { workflowStage: nextStage });
      await logEvent(selectedReservation, 'DOCUMENT_STATUS', `${document.documentNumber || documentLabels[document.documentType || 'QUOTE']} : ${status}.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible de mettre à jour le document.'); }
  };

  const printDocument = (document: RentalDocument) => {
    if (!selectedReservation) return;
    const popup = window.open('', '_blank', 'width=900,height=800');
    if (!popup) return setError('Le navigateur a bloqué la fenêtre d’impression.');
    const linked = reservationItems.filter((entry) => entry.reservationId === selectedReservation._id);
    const rows = linked.map((entry) => `<tr><td>${escapeHtml(entry.assetTitle || entry.assetNumber || 'Équipement')}</td><td>${escapeHtml(entry.pricingMode || 'Tarif')}</td><td style="text-align:right">${escapeHtml(money(entry.lineTotalCents, entry.currency || selectedReservation.currency || 'CAD'))}</td></tr>`).join('');
    popup.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(document.documentNumber || 'Document')}</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:40px;max-width:900px;margin:auto}h1{margin-bottom:4px}.muted{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}.total{font-size:20px;text-align:right;margin-top:20px}.box{padding:16px;background:#f8fafc;border-radius:8px;margin-top:20px}@media print{button{display:none}}</style></head><body><h1>${escapeHtml(documentLabels[document.documentType || 'QUOTE'])}</h1><div class="muted">${escapeHtml(document.documentNumber || '')}</div><div class="box"><strong>${escapeHtml(selectedReservation.customerName || 'Client')}</strong><br>${escapeHtml(selectedReservation.customerEmail || '')}<br>${escapeHtml(selectedReservation.customerPhone || '')}</div><p><strong>Réservation :</strong> ${escapeHtml(selectedReservation.reservationNumber || '')}<br><strong>Période :</strong> ${escapeHtml(dateTime(selectedReservation.startDateTime))} → ${escapeHtml(dateTime(selectedReservation.endDateTime))}</p><table><thead><tr><th>Équipement</th><th>Tarification</th><th style="text-align:right">Montant</th></tr></thead><tbody>${rows}</tbody></table><div class="total"><strong>Total : ${escapeHtml(money(document.amountCents, document.currency || 'CAD'))}</strong></div>${document.documentType === 'CONTRACT' ? '<div class="box"><strong>Acceptation du contrat</strong><p>Le client reconnaît avoir pris connaissance des conditions de location et accepte la responsabilité des équipements pendant la période de location.</p><p>Signature : __________________________</p></div>' : ''}<p class="muted">Généré par RentalFlow</p><button onclick="window.print()">Imprimer / Enregistrer PDF</button></body></html>`);
    popup.document.close();
  };

  const savePayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedReservation?._id || !paymentsEnabled) return;
    const amountCents = cents(paymentForm.amount);
    if (amountCents <= 0) return setError('Le montant doit être supérieur à 0.');
    setSaving(true); setError('');
    try {
      const created = await items.insert(PAYMENTS, {
        reservationId: selectedReservation._id, reservationNumber: selectedReservation.reservationNumber || '',
        paymentNumber: generatedNumber('PAY'), paymentType: paymentForm.paymentType, method: paymentForm.method,
        status: paymentForm.status, amountCents, currency: selectedReservation.currency || 'CAD', paymentDate: new Date(),
        reference: paymentForm.reference.trim(), notes: paymentForm.notes.trim(),
      }) as Payment;
      const nextPayments = [...payments, created]; setPayments(nextPayments);
      const paid = nextPayments.filter((entry) => entry.reservationId === selectedReservation._id && entry.paymentType === 'PAYMENT' && entry.status === 'PAID').reduce((sum, entry) => sum + (entry.amountCents || 0), 0)
        - nextPayments.filter((entry) => entry.reservationId === selectedReservation._id && entry.paymentType === 'REFUND' && entry.status === 'PAID').reduce((sum, entry) => sum + (entry.amountCents || 0), 0);
      const stage = paid >= (selectedReservation.totalCents || 0) && (selectedReservation.totalCents || 0) > 0 ? 'READY' : 'PAYMENT';
      await updateReservation(selectedReservation, { workflowStage: maxStage(selectedReservation.workflowStage, stage) });
      if (paid >= (selectedReservation.totalCents || 0)) {
        const invoices = documents.filter((doc) => doc.reservationId === selectedReservation._id && doc.documentType === 'INVOICE');
        for (const invoice of invoices) {
          if (invoice._id && invoice.status !== 'PAID') {
            const updated = await items.update(DOCUMENTS, { ...invoice, status: 'PAID' }) as RentalDocument;
            setDocuments((current) => current.map((entry) => entry._id === updated._id ? updated : entry));
          }
        }
      }
      await logEvent(selectedReservation, 'PAYMENT_RECORDED', `${paymentLabels[paymentForm.paymentType]} de ${money(amountCents, selectedReservation.currency || 'CAD')} enregistré.`);
      setPaymentOpen(false); setPaymentForm(blankPayment); setSuccess('Transaction enregistrée.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d’enregistrer la transaction.'); }
    finally { setSaving(false); }
  };

  const saveInspection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedReservation?._id || !inspectionsEnabled) return;
    const assetItem = reservationItems.find((entry) => entry.reservationId === selectedReservation._id && entry.assetId === inspectionForm.assetId);
    if (!assetItem) return setError('Sélectionnez un équipement de la réservation.');
    setSaving(true); setError('');
    try {
      const created = await items.insert(INSPECTIONS, {
        reservationId: selectedReservation._id, reservationNumber: selectedReservation.reservationNumber || '',
        inspectionNumber: generatedNumber('INS'), inspectionType: inspectionForm.inspectionType, status: 'COMPLETED',
        assetId: assetItem.assetId || '', assetNumber: assetItem.assetNumber || '', assetTitle: assetItem.assetTitle || '',
        condition: inspectionForm.condition, hasDamage: inspectionForm.hasDamage,
        damageDescription: inspectionForm.hasDamage ? inspectionForm.damageDescription.trim() : '',
        damageAmountCents: inspectionForm.hasDamage ? cents(inspectionForm.damageAmount) : 0,
        photoUrls: inspectionForm.photoUrls.trim(), signerName: inspectionForm.signerName.trim(), inspectionDate: new Date(),
        notes: inspectionForm.notes.trim(),
      }) as Inspection;
      setInspections((current) => [...current, created]);
      await logEvent(selectedReservation, 'INSPECTION_COMPLETED', `${inspectionForm.inspectionType === 'DEPARTURE' ? 'Inspection de départ' : 'Inspection de retour'} complétée pour ${assetItem.assetTitle || assetItem.assetNumber || 'équipement'}.`);
      setInspectionOpen(false); setInspectionForm(blankInspection); setSuccess('Inspection enregistrée.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d’enregistrer l’inspection.'); }
    finally { setSaving(false); }
  };

  const confirmCheckout = async () => {
    if (!selectedReservation?._id || selectedReservation.status === 'RENTED') return;
    if (!window.confirm('Confirmer le départ de cette réservation ?')) return;
    try {
      const updated = await updateReservation(selectedReservation, { status: 'RENTED', workflowStage: 'RENTED', checkoutDateTime: new Date() }, 'CHECKOUT', 'Départ confirmé.');
      await updateLinkedItemsStatus(updated._id!, 'RENTED'); setSuccess('Départ confirmé.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible de confirmer le départ.'); }
  };

  const confirmReturn = async () => {
    if (!selectedReservation?._id || selectedReservation.status !== 'RENTED') return;
    if (!window.confirm('Confirmer le retour ? Les équipements seront libérés.')) return;
    try {
      const updated = await updateReservation(selectedReservation, { status: 'RETURNED', workflowStage: 'RETURNED', returnDateTime: new Date() }, 'RETURN', 'Retour confirmé et équipements libérés.');
      await updateLinkedItemsStatus(updated._id!, 'RETURNED'); setSuccess('Retour confirmé.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible de confirmer le retour.'); }
  };

  const closeReservation = async () => {
    if (!selectedReservation?._id || selectedReservation.status !== 'RETURNED') return;
    if (!window.confirm('Clôturer définitivement cette réservation ?')) return;
    try {
      const updated = await updateReservation(selectedReservation, { status: 'COMPLETED', workflowStage: 'COMPLETED', closedDateTime: new Date() }, 'RESERVATION_CLOSED', 'Réservation clôturée.');
      await updateLinkedItemsStatus(updated._id!, 'COMPLETED'); setSuccess('Réservation clôturée.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible de clôturer la réservation.'); }
  };

  const saveNotes = async () => {
    if (!selectedReservation) return;
    try {
      await updateReservation(selectedReservation, { notes: notesDraft.trim() }, 'NOTES_UPDATED', 'Notes de la réservation mises à jour.');
      setSuccess('Notes enregistrées.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d’enregistrer les notes.'); }
  };

  const selectView = (next: CalendarView) => {
    if ((next === 'WEEK' || next === 'AVAILABILITY') && !advancedViews) return;
    setView(next);
  };
  const sortedReservations = useMemo(() => [...reservations].sort((a, b) => asDate(a.startDateTime).getTime() - asDate(b.startDateTime).getTime()), [reservations]);
  const monthReservations = useMemo(() => sortedReservations.filter((reservation) => { const d = asDate(reservation.startDateTime); return d.getFullYear() === monthCursor.getFullYear() && d.getMonth() === monthCursor.getMonth(); }), [monthCursor, sortedReservations]);
  const weekEnd = useMemo(() => new Date(weekCursor.getTime() + 7 * 24 * 60 * 60 * 1000), [weekCursor]);
  const weekReservations = useMemo(() => sortedReservations.filter((reservation) => { const d = asDate(reservation.startDateTime); return d >= weekCursor && d < weekEnd; }), [sortedReservations, weekCursor, weekEnd]);
  const availabilityResult = useMemo(() => {
    if (!availabilityStart || !availabilityEnd) return null;
    const start = new Date(availabilityStart); const end = new Date(availabilityEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
    return activeAssets.map((asset) => ({ asset, available: !!asset._id && isAvailable(asset._id, start, end, numberValue(availabilityBefore), numberValue(availabilityAfter)) }));
  }, [activeAssets, availabilityAfter, availabilityBefore, availabilityEnd, availabilityStart, isAvailable]);

  const selectedItems = useMemo(() => reservationItems.filter((entry) => entry.reservationId === selectedReservation?._id), [reservationItems, selectedReservation?._id]);
  const selectedDocuments = useMemo(() => documents.filter((entry) => entry.reservationId === selectedReservation?._id).sort((a, b) => asDate(b._createdDate).getTime() - asDate(a._createdDate).getTime()), [documents, selectedReservation?._id]);
  const selectedPayments = useMemo(() => payments.filter((entry) => entry.reservationId === selectedReservation?._id).sort((a, b) => asDate(b.paymentDate || b._createdDate).getTime() - asDate(a.paymentDate || a._createdDate).getTime()), [payments, selectedReservation?._id]);
  const selectedInspections = useMemo(() => inspections.filter((entry) => entry.reservationId === selectedReservation?._id).sort((a, b) => asDate(b.inspectionDate || b._createdDate).getTime() - asDate(a.inspectionDate || a._createdDate).getTime()), [inspections, selectedReservation?._id]);
  const selectedActivity = useMemo(() => activity.filter((entry) => entry.reservationId === selectedReservation?._id).sort((a, b) => asDate(b.eventDate || b._createdDate).getTime() - asDate(a.eventDate || a._createdDate).getTime()), [activity, selectedReservation?._id]);
  const paidCents = selectedPayments.filter((entry) => entry.paymentType === 'PAYMENT' && entry.status === 'PAID').reduce((sum, entry) => sum + (entry.amountCents || 0), 0) - selectedPayments.filter((entry) => entry.paymentType === 'REFUND' && entry.status === 'PAID').reduce((sum, entry) => sum + (entry.amountCents || 0), 0);
  const depositHeldCents = selectedPayments.filter((entry) => entry.paymentType === 'SECURITY_DEPOSIT' && (entry.status === 'PAID' || entry.status === 'AUTHORIZED')).reduce((sum, entry) => sum + (entry.amountCents || 0), 0) - selectedPayments.filter((entry) => entry.paymentType === 'DEPOSIT_REFUND' && entry.status === 'PAID').reduce((sum, entry) => sum + (entry.amountCents || 0), 0);
  const balanceCents = Math.max(0, (selectedReservation?.totalCents || 0) - paidCents);

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header title="Calendrier / Réservations" subtitle="Planifiez, documentez et exécutez chaque location du devis au retour." />
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
              {view === 'MONTH' && <div style={card}><CalendarHeader title={new Intl.DateTimeFormat('fr-CA', { month: 'long', year: 'numeric' }).format(monthCursor)} onPrevious={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))} onNext={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))} /><ReservationCards reservations={monthReservations} reservationItems={reservationItems} onOpen={openReservation} onCancel={cancelReservation} /></div>}
              {view === 'WEEK' && <div style={card}><CalendarHeader title={`${new Intl.DateTimeFormat('fr-CA', { month: 'short', day: 'numeric' }).format(weekCursor)} au ${new Intl.DateTimeFormat('fr-CA', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(weekEnd.getTime() - 1))}`} onPrevious={() => setWeekCursor(new Date(weekCursor.getTime() - 7 * 86400000))} onNext={() => setWeekCursor(new Date(weekCursor.getTime() + 7 * 86400000))} /><ReservationCards reservations={weekReservations} reservationItems={reservationItems} onOpen={openReservation} onCancel={cancelReservation} /></div>}
              {view === 'LIST' && <div style={card}><h2 style={{ marginTop: 0 }}>Toutes les réservations</h2><ReservationCards reservations={sortedReservations} reservationItems={reservationItems} onOpen={openReservation} onCancel={cancelReservation} /></div>}
              {view === 'AVAILABILITY' && <div style={card}><h2 style={{ marginTop: 0 }}>Recherche de disponibilité</h2><p style={{ color: '#64748b' }}>Le buffer bloque l’équipement avant/après la location sans être facturé.</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}><Field label="Début"><input type="datetime-local" style={input} value={availabilityStart} onChange={(e) => setAvailabilityStart(e.target.value)} /></Field><Field label="Fin"><input type="datetime-local" style={input} value={availabilityEnd} onChange={(e) => setAvailabilityEnd(e.target.value)} /></Field><Field label="Buffer avant (h)"><input type="number" min="0" step="0.5" style={input} value={availabilityBefore} onChange={(e) => setAvailabilityBefore(e.target.value)} /></Field><Field label="Buffer après (h)"><input type="number" min="0" step="0.5" style={input} value={availabilityAfter} onChange={(e) => setAvailabilityAfter(e.target.value)} /></Field></div><div style={{ marginTop: 20 }}>{!availabilityResult ? <div style={{ color: '#64748b' }}>Choisissez une période valide.</div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>{availabilityResult.map(({ asset, available }) => <div key={asset._id || asset.assetNumber} style={{ border: `1px solid ${available ? '#86efac' : '#fecaca'}`, background: available ? '#f0fdf4' : '#fef2f2', borderRadius: 10, padding: 14 }}><strong>{asset.title || 'Sans nom'}</strong><div style={{ color: '#64748b', marginTop: 4 }}>{asset.assetNumber || '—'}</div><div style={{ marginTop: 8, fontWeight: 700, color: available ? '#166534' : '#991b1b' }}>{available ? 'Disponible' : 'Indisponible'}</div></div>)}</div>}</div></div>}
            </>}
          </div>
        </Page.Content>
      </Page>

      {formOpen && <Modal onClose={() => !saving && setFormOpen(false)} maxWidth={920}>
        <form onSubmit={saveReservation}>
          <ModalHeader title="Nouvelle réservation" subtitle="La période facturée et la période bloquée sont calculées séparément." onClose={() => !saving && setFormOpen(false)} />
          <div style={{ padding: 24 }}>
            {formError && <ErrorBox>{formError}</ErrorBox>}
            <h3>Client</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}><button type="button" style={form.customerMode === 'EXISTING' ? primary : secondary} onClick={() => setForm({ ...form, customerMode: 'EXISTING' })}>Client existant</button><button type="button" style={form.customerMode === 'NEW' ? primary : secondary} onClick={() => setForm({ ...form, customerMode: 'NEW' })}>Nouveau client</button></div>
            {form.customerMode === 'EXISTING' ? <Field label="Client *"><select style={input} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">Sélectionner…</option>{activeCustomers.map((customer) => <option key={customer._id} value={customer._id}>{customerName(customer)}{customer.customerNumber ? ` · ${customer.customerNumber}` : ''}</option>)}</select></Field> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}><Field label="Prénom"><input style={input} value={form.newFirstName} onChange={(e) => setForm({ ...form, newFirstName: e.target.value })} /></Field><Field label="Nom"><input style={input} value={form.newLastName} onChange={(e) => setForm({ ...form, newLastName: e.target.value })} /></Field><Field label="Entreprise"><input style={input} value={form.newCompanyName} onChange={(e) => setForm({ ...form, newCompanyName: e.target.value })} /></Field><Field label="Courriel"><input type="email" style={input} value={form.newEmail} onChange={(e) => setForm({ ...form, newEmail: e.target.value })} /></Field><Field label="Téléphone"><input style={input} value={form.newPhone} onChange={(e) => setForm({ ...form, newPhone: e.target.value })} /></Field></div>}
            <h3 style={{ marginTop: 24 }}>Période de location</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}><Field label="Début *"><input type="datetime-local" style={input} value={form.startDateTime} onChange={(e) => setForm({ ...form, startDateTime: e.target.value })} /></Field><Field label="Fin *"><input type="datetime-local" style={input} value={form.endDateTime} onChange={(e) => setForm({ ...form, endDateTime: e.target.value })} /></Field><Field label="Buffer avant (heures)"><input type="number" min="0" step="0.5" style={input} value={form.bufferBeforeHours} onChange={(e) => setForm({ ...form, bufferBeforeHours: e.target.value })} /></Field><Field label="Buffer après (heures)"><input type="number" min="0" step="0.5" style={input} value={form.bufferAfterHours} onChange={(e) => setForm({ ...form, bufferAfterHours: e.target.value })} /></Field></div>
            <h3 style={{ marginTop: 24 }}>Équipements</h3>
            {!formDates.valid ? <div style={{ color: '#64748b' }}>Choisissez d’abord une période valide.</div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))', gap: 12 }}>{activeAssets.map((asset) => { const id = asset._id || ''; const available = formAssetAvailability.get(id) === true; const selected = selectedAssetIds.includes(id); return <label key={id || asset.assetNumber} style={{ border: `1px solid ${selected ? '#116dff' : '#e5e7eb'}`, borderRadius: 10, padding: 14, opacity: available ? 1 : .55, cursor: available ? 'pointer' : 'not-allowed', background: selected ? '#eff6ff' : '#fff' }}><div style={{ display: 'flex', gap: 10 }}><input type="checkbox" checked={selected} disabled={!available} onChange={() => available && toggleAsset(id)} /><div><strong>{asset.title || 'Sans nom'}</strong><div style={{ color: '#64748b' }}>{asset.assetNumber || '—'} · {asset.productType || 'Équipement'}</div><div style={{ marginTop: 5, color: available ? '#166534' : '#991b1b', fontWeight: 600 }}>{available ? 'Disponible' : 'Conflit réservation/buffer'}</div></div></div></label>; })}</div>}
            {priceLines.length > 0 && <div style={{ ...card, marginTop: 20, background: '#f8fafc' }}><h3 style={{ marginTop: 0 }}>Tarification</h3>{priceLines.map((line) => <div key={line.asset._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #e5e7eb' }}><span>{line.asset.title} · {line.billableDays} jour(s) · {line.pricingMode}</span><strong>{money(line.totalCents, line.asset.currency || currency)}</strong></div>)}{customerDiscountPercent > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}><span>Rabais client ({customerDiscountPercent} %)</span><strong>-{money(customerDiscountCents, currency)}</strong></div>}<div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 18 }}><strong>Total</strong><strong>{money(totalCents, currency)}</strong></div></div>}
            <div style={{ marginTop: 20 }}><Field label="Notes"><textarea style={{ ...input, minHeight: 90 }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
          </div>
          <ModalFooter><button type="button" style={secondary} onClick={() => !saving && setFormOpen(false)}>Annuler</button><button type="submit" style={primary} disabled={saving}>{saving ? 'Création…' : 'Créer la réservation'}</button></ModalFooter>
        </form>
      </Modal>}

      {selectedReservation && <Modal onClose={() => setSelectedReservation(null)} maxWidth={1120}>
        <ModalHeader title={`${selectedReservation.reservationNumber || 'Réservation'} · ${selectedReservation.customerName || 'Client'}`} subtitle={`${dateTime(selectedReservation.startDateTime)} → ${dateTime(selectedReservation.endDateTime)}`} onClose={() => setSelectedReservation(null)} />
        <div style={{ padding: '16px 22px 0', display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid #e5e7eb' }}>{([
          ['DETAILS', 'Détails'], ['EQUIPMENT', 'Équipements'], ['PAYMENTS', 'Paiements'], ['DOCUMENTS', 'Documents'], ['INSPECTION', 'Inspection'], ['NOTES', 'Notes'], ['HISTORY', 'Historique'],
        ] as [DetailTab, string][]).map(([tab, label]) => <button key={tab} onClick={() => setDetailTab(tab)} style={{ border: 0, borderBottom: detailTab === tab ? '3px solid #116dff' : '3px solid transparent', padding: '11px 10px', background: 'transparent', color: detailTab === tab ? '#116dff' : '#475569', fontWeight: 700, cursor: 'pointer' }}>{label}</button>)}</div>
        <div style={{ padding: 24, minHeight: 440, maxHeight: '68vh', overflowY: 'auto' }}>
          {detailTab === 'DETAILS' && <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}><Summary label="Étape" value={stageLabels[safeStage(selectedReservation.workflowStage)]} /><Summary label="Statut" value={selectedReservation.status || 'CONFIRMED'} /><Summary label="Total" value={money(selectedReservation.totalCents, selectedReservation.currency || 'CAD')} /><Summary label="Solde" value={money(balanceCents, selectedReservation.currency || 'CAD')} /><Summary label="Dépôt détenu" value={money(Math.max(0, depositHeldCents), selectedReservation.currency || 'CAD')} /></div>
            <div style={{ ...card, marginTop: 18 }}><h3 style={{ marginTop: 0 }}>Client</h3><strong>{selectedReservation.customerName || '—'}</strong><div style={{ color: '#64748b', marginTop: 5 }}>{selectedReservation.customerEmail || '—'} · {selectedReservation.customerPhone || '—'}</div></div>
            <div style={{ ...card, marginTop: 18 }}><h3 style={{ marginTop: 0 }}>Location</h3><div><strong>Facturée :</strong> {dateTime(selectedReservation.startDateTime)} → {dateTime(selectedReservation.endDateTime)}</div><div style={{ marginTop: 7 }}><strong>Buffer :</strong> {selectedReservation.bufferBeforeHours || 0} h avant · {selectedReservation.bufferAfterHours || 0} h après</div>{selectedItems[0] && <div style={{ marginTop: 7 }}><strong>Bloquée :</strong> {dateTime(selectedItems[0].blockedStartDateTime)} → {dateTime(selectedItems[0].blockedEndDateTime)}</div>}</div>
            <div style={{ ...card, marginTop: 18 }}><h3 style={{ marginTop: 0 }}>Actions opérationnelles</h3><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{selectedReservation.status === 'CONFIRMED' && <button style={successButton} onClick={() => void confirmCheckout()}>Confirmer le départ</button>}{selectedReservation.status === 'RENTED' && <button style={successButton} onClick={() => void confirmReturn()}>Confirmer le retour</button>}{selectedReservation.status === 'RETURNED' && <button style={successButton} onClick={() => void closeReservation()}>Clôturer</button>}{!['CANCELLED', 'COMPLETED'].includes(selectedReservation.status || '') && <button style={danger} onClick={() => void cancelReservation(selectedReservation)}>Annuler la réservation</button>}</div></div>
          </>}

          {detailTab === 'EQUIPMENT' && <div>{selectedItems.length === 0 ? <Empty text="Aucun équipement lié." /> : selectedItems.map((entry) => <div key={entry._id} style={{ ...card, marginBottom: 10 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}><div><strong>{entry.assetTitle || entry.assetNumber}</strong><div style={{ color: '#64748b', marginTop: 4 }}>{entry.assetNumber} · {entry.pricingMode || 'Tarif'}</div><div style={{ color: '#64748b', marginTop: 4 }}>Bloqué : {dateTime(entry.blockedStartDateTime)} → {dateTime(entry.blockedEndDateTime)}</div></div><div style={{ textAlign: 'right' }}><strong>{money(entry.lineTotalCents, entry.currency || 'CAD')}</strong><div style={{ color: '#64748b', marginTop: 5 }}>{entry.status}</div></div></div></div>)}</div>}

          {detailTab === 'PAYMENTS' && <>{!paymentsEnabled ? <Locked plan="Starter" text="Paiements et dépôts de sécurité" /> : <><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}><Summary label="Total" value={money(selectedReservation.totalCents, selectedReservation.currency || 'CAD')} /><Summary label="Payé" value={money(paidCents, selectedReservation.currency || 'CAD')} /><Summary label="Solde" value={money(balanceCents, selectedReservation.currency || 'CAD')} /><Summary label="Dépôt détenu" value={money(Math.max(0, depositHeldCents), selectedReservation.currency || 'CAD')} /></div><div style={{ display: 'flex', justifyContent: 'flex-end', margin: '16px 0' }}><button style={primary} onClick={() => { setPaymentForm(blankPayment); setPaymentOpen(true); }}>+ Transaction</button></div>{selectedPayments.length === 0 ? <Empty text="Aucun paiement ou dépôt enregistré." /> : selectedPayments.map((entry) => <div key={entry._id} style={{ ...card, marginBottom: 9 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><div><strong>{paymentLabels[entry.paymentType || 'PAYMENT']}</strong><div style={{ color: '#64748b' }}>{entry.paymentNumber} · {entry.method} · {entry.status}</div></div><div style={{ textAlign: 'right' }}><strong>{money(entry.amountCents, entry.currency || 'CAD')}</strong><div style={{ color: '#64748b' }}>{dateTime(entry.paymentDate)}</div></div></div></div>)}</>}</>}

          {detailTab === 'DOCUMENTS' && <>{!documentsEnabled ? <Locked plan="Starter" text="Devis, contrats et factures" /> : <><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}><button style={secondary} onClick={() => void createDocument('QUOTE')}>+ Devis</button><button style={secondary} onClick={() => void createDocument('CONTRACT')}>+ Contrat</button><button style={secondary} onClick={() => void createDocument('INVOICE')}>+ Facture</button></div>{selectedDocuments.length === 0 ? <Empty text="Aucun document créé." /> : selectedDocuments.map((doc) => <div key={doc._id} style={{ ...card, marginBottom: 10 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><strong>{documentLabels[doc.documentType || 'QUOTE']} · {doc.documentNumber}</strong><div style={{ color: '#64748b', marginTop: 4 }}>Statut : {doc.status} · {money(doc.amountCents, doc.currency || 'CAD')}</div>{doc.signerName && <div style={{ color: '#64748b', marginTop: 4 }}>Signé par {doc.signerName} le {dateTime(doc.signedDate)}</div>}</div><div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}><button style={secondary} onClick={() => printDocument(doc)}>Imprimer / PDF</button>{doc.status === 'DRAFT' && <button style={secondary} onClick={() => void updateDocumentStatus(doc, doc.documentType === 'INVOICE' ? 'ISSUED' : 'SENT')}>{doc.documentType === 'INVOICE' ? 'Émettre' : 'Marquer envoyé'}</button>}{doc.documentType === 'QUOTE' && doc.status === 'SENT' && <button style={successButton} onClick={() => void updateDocumentStatus(doc, 'ACCEPTED')}>Accepter</button>}{doc.documentType === 'CONTRACT' && ['DRAFT', 'SENT'].includes(doc.status || '') && <button style={successButton} onClick={() => void updateDocumentStatus(doc, 'SIGNED')}>Signer</button>}</div></div></div>)}</>}</>}

          {detailTab === 'INSPECTION' && <>{!inspectionsEnabled ? <Locked plan="Business" text="Inspections départ/retour et dommages" /> : <><div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}><button style={primary} onClick={() => { setInspectionForm({ ...blankInspection, inspectionType: selectedReservation.status === 'RENTED' || selectedReservation.status === 'RETURNED' ? 'RETURN' : 'DEPARTURE', assetId: selectedItems[0]?.assetId || '' }); setInspectionOpen(true); }}>+ Inspection</button></div>{selectedInspections.length === 0 ? <Empty text="Aucune inspection enregistrée." /> : selectedInspections.map((entry) => <div key={entry._id} style={{ ...card, marginBottom: 10 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><strong>{entry.inspectionType === 'DEPARTURE' ? 'Départ' : 'Retour'} · {entry.assetTitle || entry.assetNumber}</strong><div style={{ color: '#64748b', marginTop: 4 }}>État : {entry.condition} · {dateTime(entry.inspectionDate)}</div>{entry.hasDamage && <div style={{ color: '#b91c1c', marginTop: 5 }}>Dommage : {entry.damageDescription || 'Oui'} · {money(entry.damageAmountCents, selectedReservation.currency || 'CAD')}</div>}{entry.signerName && <div style={{ color: '#64748b', marginTop: 5 }}>Signataire : {entry.signerName}</div>}</div><strong>{entry.status}</strong></div></div>)}</>}</>}

          {detailTab === 'NOTES' && <div><Field label="Notes internes"><textarea style={{ ...input, minHeight: 260 }} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} /></Field><div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><button style={primary} onClick={() => void saveNotes()}>Enregistrer</button></div></div>}

          {detailTab === 'HISTORY' && <>{!historyEnabled ? <Locked plan="Business" text="Historique complet des actions" /> : selectedActivity.length === 0 ? <Empty text="Aucune activité enregistrée pour le moment." /> : <div style={{ borderLeft: '2px solid #cbd5e1', marginLeft: 10, paddingLeft: 20 }}>{selectedActivity.map((entry) => <div key={entry._id} style={{ marginBottom: 18 }}><div style={{ fontWeight: 700 }}>{entry.description}</div><div style={{ color: '#64748b', fontSize: 13, marginTop: 3 }}>{dateTime(entry.eventDate || entry._createdDate)} · {entry.actor || 'RentalFlow'}</div></div>)}</div>}</>}
        </div>
      </Modal>}

      {paymentOpen && selectedReservation && <Modal onClose={() => !saving && setPaymentOpen(false)} maxWidth={620}><form onSubmit={savePayment}><ModalHeader title="Nouvelle transaction" subtitle={selectedReservation.reservationNumber || ''} onClose={() => !saving && setPaymentOpen(false)} /><div style={{ padding: 24, display: 'grid', gap: 14 }}><Field label="Type"><select style={input} value={paymentForm.paymentType} onChange={(e) => setPaymentForm({ ...paymentForm, paymentType: e.target.value as PaymentType })}><option value="PAYMENT">Paiement</option><option value="SECURITY_DEPOSIT">Dépôt de sécurité</option><option value="REFUND">Remboursement</option><option value="DEPOSIT_REFUND">Remboursement dépôt</option><option value="DAMAGE_CHARGE">Frais de dommage</option></select></Field><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><Field label="Montant"><input style={input} inputMode="decimal" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} placeholder="100,00" /></Field><Field label="Méthode"><select style={input} value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}><option value="CARD">Carte</option><option value="CASH">Comptant</option><option value="TRANSFER">Virement</option><option value="WIX">Wix Payments</option><option value="OTHER">Autre</option></select></Field></div><Field label="Statut"><select style={input} value={paymentForm.status} onChange={(e) => setPaymentForm({ ...paymentForm, status: e.target.value })}><option value="PAID">Payé</option><option value="AUTHORIZED">Autorisé / retenu</option><option value="PENDING">En attente</option></select></Field><Field label="Référence"><input style={input} value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} /></Field><Field label="Notes"><textarea style={{ ...input, minHeight: 80 }} value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} /></Field></div><ModalFooter><button type="button" style={secondary} onClick={() => setPaymentOpen(false)}>Annuler</button><button type="submit" style={primary} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button></ModalFooter></form></Modal>}

      {inspectionOpen && selectedReservation && <Modal onClose={() => !saving && setInspectionOpen(false)} maxWidth={720}><form onSubmit={saveInspection}><ModalHeader title="Inspection" subtitle={selectedReservation.reservationNumber || ''} onClose={() => !saving && setInspectionOpen(false)} /><div style={{ padding: 24, display: 'grid', gap: 14 }}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><Field label="Type"><select style={input} value={inspectionForm.inspectionType} onChange={(e) => setInspectionForm({ ...inspectionForm, inspectionType: e.target.value as InspectionType })}><option value="DEPARTURE">Départ</option><option value="RETURN">Retour</option></select></Field><Field label="Équipement"><select style={input} value={inspectionForm.assetId} onChange={(e) => setInspectionForm({ ...inspectionForm, assetId: e.target.value })}><option value="">Sélectionner…</option>{selectedItems.map((entry) => <option key={entry.assetId} value={entry.assetId}>{entry.assetTitle || entry.assetNumber}</option>)}</select></Field></div><Field label="État"><select style={input} value={inspectionForm.condition} onChange={(e) => setInspectionForm({ ...inspectionForm, condition: e.target.value })}><option value="GOOD">Bon</option><option value="FAIR">Acceptable</option><option value="DAMAGED">Endommagé</option></select></Field><label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={inspectionForm.hasDamage} onChange={(e) => setInspectionForm({ ...inspectionForm, hasDamage: e.target.checked })} /> Dommage constaté</label>{inspectionForm.hasDamage && <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}><Field label="Description"><input style={input} value={inspectionForm.damageDescription} onChange={(e) => setInspectionForm({ ...inspectionForm, damageDescription: e.target.value })} /></Field><Field label="Montant dommage"><input style={input} inputMode="decimal" value={inspectionForm.damageAmount} onChange={(e) => setInspectionForm({ ...inspectionForm, damageAmount: e.target.value })} /></Field></div>}<Field label="Photos (URLs, séparées par des virgules)"><input style={input} value={inspectionForm.photoUrls} onChange={(e) => setInspectionForm({ ...inspectionForm, photoUrls: e.target.value })} /></Field><Field label="Signataire"><input style={input} value={inspectionForm.signerName} onChange={(e) => setInspectionForm({ ...inspectionForm, signerName: e.target.value })} /></Field><Field label="Notes"><textarea style={{ ...input, minHeight: 90 }} value={inspectionForm.notes} onChange={(e) => setInspectionForm({ ...inspectionForm, notes: e.target.value })} /></Field></div><ModalFooter><button type="button" style={secondary} onClick={() => setInspectionOpen(false)}>Annuler</button><button type="submit" style={primary} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer l’inspection'}</button></ModalFooter></form></Modal>}
    </WixDesignSystemProvider>
  );
};

const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => <label style={{ display: 'block' }}><span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</span>{children}</label>;
const ViewButton: FC<{ active: boolean; locked?: boolean; onClick: () => void; children: string }> = ({ active, locked, onClick, children }) => <button onClick={onClick} title={locked ? 'Plan Business requis' : undefined} style={{ ...secondary, background: active ? '#116dff' : '#fff', color: active ? '#fff' : locked ? '#94a3b8' : '#116dff', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? .65 : 1 }}>{locked ? '🔒 ' : ''}{children}</button>;
const CalendarHeader: FC<{ title: string; onPrevious: () => void; onNext: () => void }> = ({ title, onPrevious, onNext }) => <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}><button style={secondary} onClick={onPrevious}>‹</button><h2 style={{ margin: 0, textTransform: 'capitalize' }}>{title}</h2><button style={secondary} onClick={onNext}>›</button></div>;
const Summary: FC<{ label: string; value: string }> = ({ label, value }) => <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14 }}><div style={{ color: '#64748b', fontSize: 13 }}>{label}</div><div style={{ fontSize: 18, fontWeight: 700, marginTop: 5 }}>{value}</div></div>;
const Empty: FC<{ text: string }> = ({ text }) => <div style={{ padding: 34, textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 10 }}>{text}</div>;
const Locked: FC<{ plan: string; text: string }> = ({ plan, text }) => <div style={{ padding: 30, textAlign: 'center', background: '#faf5ff', color: '#6b21a8', border: '1px solid #d8b4fe', borderRadius: 10 }}><strong>🔒 {text}</strong><div style={{ marginTop: 7 }}>Disponible à partir du plan {plan}.</div></div>;
const ErrorBox: FC<{ children: ReactNode }> = ({ children }) => <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, padding: 12, marginBottom: 18 }}>{children}</div>;

const Modal: FC<{ onClose: () => void; maxWidth: number; children: ReactNode }> = ({ onClose, maxWidth, children }) => <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}><div onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth, maxHeight: '94vh', overflow: 'hidden', background: '#fff', borderRadius: 14, boxShadow: '0 22px 70px rgba(0,0,0,.25)' }}>{children}</div></div>;
const ModalHeader: FC<{ title: string; subtitle?: string; onClose: () => void }> = ({ title, subtitle, onClose }) => <div style={{ padding: '19px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><h2 style={{ margin: 0 }}>{title}</h2>{subtitle && <div style={{ color: '#64748b', marginTop: 4 }}>{subtitle}</div>}</div><button type="button" onClick={onClose} style={{ border: 0, background: 'transparent', fontSize: 26, cursor: 'pointer' }}>×</button></div>;
const ModalFooter: FC<{ children: ReactNode }> = ({ children }) => <div style={{ padding: '15px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>{children}</div>;

const ReservationCards: FC<{ reservations: Reservation[]; reservationItems: ReservationItem[]; onOpen: (reservation: Reservation) => void; onCancel: (reservation: Reservation) => void }> = ({ reservations, reservationItems, onOpen, onCancel }) => {
  if (reservations.length === 0) return <Empty text="Aucune réservation dans cette période." />;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{reservations.map((reservation) => {
    const linked = reservationItems.filter((entry) => entry.reservationId === reservation._id); const cancelled = reservation.status === 'CANCELLED';
    return <div key={reservation._id || reservation.reservationNumber} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 15, opacity: cancelled ? .55 : 1 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}><div><div style={{ fontWeight: 700 }}>{reservation.reservationNumber || 'Réservation'} · {reservation.customerName || 'Client'}</div><div style={{ color: '#64748b', marginTop: 4 }}>{dateTime(reservation.startDateTime)} → {dateTime(reservation.endDateTime)}</div><div style={{ color: '#64748b', marginTop: 4 }}>{linked.map((entry) => entry.assetTitle || entry.assetNumber).filter(Boolean).join(', ') || 'Aucun équipement'}</div><div style={{ color: '#64748b', marginTop: 4 }}>Étape : {stageLabels[safeStage(reservation.workflowStage)]} · Buffer {reservation.bufferBeforeHours || 0} h / {reservation.bufferAfterHours || 0} h</div></div><div style={{ textAlign: 'right' }}><div style={{ fontWeight: 700 }}>{money(reservation.totalCents, reservation.currency || 'CAD')}</div><div style={{ marginTop: 5, fontSize: 13, fontWeight: 700, color: cancelled ? '#991b1b' : '#166534' }}>{reservation.status || 'CONFIRMED'}</div><div style={{ display: 'flex', gap: 7, marginTop: 8 }}><button style={{ ...secondary, padding: '6px 10px' }} onClick={() => onOpen(reservation)}>Ouvrir</button>{!cancelled && reservation.status !== 'COMPLETED' && <button style={{ ...danger, padding: '6px 10px' }} onClick={() => onCancel(reservation)}>Annuler</button>}</div></div></div></div>;
  })}</div>;
};

export default ReservationsPage;
