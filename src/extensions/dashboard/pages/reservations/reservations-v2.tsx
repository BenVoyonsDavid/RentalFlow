import type { CSSProperties, FC, FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { items } from '@wix/data';
import { Page, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import { calculateRentalPrice, getBlockedRange, rangesOverlap } from '../../../../lib/rental-pricing';
import {
  calculateDeposit,
  calculateTaxes,
  parseRequiredFields,
  validateRequiredFields,
  type DepositType,
  type PaymentMode,
} from '../../../../lib/reservation-finance';

const ASSETS = '@pilotedavid1/rental-flow/assets';
const CUSTOMERS = '@pilotedavid1/rental-flow/customers';
const RESERVATIONS = '@pilotedavid1/rental-flow/reservations';
const RESERVATION_ITEMS = '@pilotedavid1/rental-flow/reservation-items';
const DOCUMENTS = '@pilotedavid1/rental-flow/documents';
const PAYMENTS = '@pilotedavid1/rental-flow/payments';
const INSPECTIONS = '@pilotedavid1/rental-flow/inspections';
const ACTIVITY = '@pilotedavid1/rental-flow/activity-log';
const SETTINGS = '@pilotedavid1/rental-flow/app-settings';
const TEMPLATES = '@pilotedavid1/rental-flow/document-templates';

type ViewMode = 'MONTH' | 'LIST' | 'AVAILABILITY';
type DetailTab = 'DETAILS' | 'EQUIPMENT' | 'PAYMENTS' | 'DOCUMENTS' | 'INSPECTION' | 'NOTES' | 'HISTORY';
type ReservationStatus = 'CONFIRMED' | 'RENTED' | 'RETURNED' | 'CANCELLED' | 'COMPLETED' | 'ERROR';
type WorkflowStage = 'RESERVATION' | 'QUOTE' | 'CONTRACT' | 'INVOICE' | 'PAYMENT' | 'READY' | 'RENTED' | 'RETURNED' | 'COMPLETED';
type DocumentType = 'QUOTE' | 'CONTRACT' | 'INVOICE';
type CustomerMode = 'EXISTING' | 'NEW';
type PaymentType = 'PAYMENT' | 'BOOKING_DEPOSIT' | 'SECURITY_DEPOSIT' | 'REFUND' | 'DEPOSIT_REFUND' | 'DAMAGE_CHARGE';
type InspectionType = 'DEPARTURE' | 'RETURN';

type Asset = {
  _id?: string; title?: string; assetNumber?: string; productType?: string; status?: string;
  dailyRateCents?: number; weeklyRateCents?: number; monthlyRateCents?: number;
  discountAfterDays?: number; discountPercent?: number; currency?: string; active?: boolean;
};

type Customer = {
  _id?: string; customerNumber?: string; firstName?: string; lastName?: string; companyName?: string;
  email?: string; phone?: string; addressLine1?: string; addressLine2?: string; city?: string;
  region?: string; postalCode?: string; country?: string; discountPercent?: number; active?: boolean;
};

type AppSettings = {
  _id?: string; settingsKey?: string; companyName?: string; logoUrl?: string; currency?: string;
  defaultBufferBeforeHours?: number; defaultBufferAfterHours?: number; taxesEnabled?: boolean;
  tax1Name?: string; tax1Rate?: number; tax2Name?: string; tax2Rate?: number; tax2Compound?: boolean;
  defaultDepositEnabled?: boolean; defaultDepositType?: DepositType; defaultDepositValue?: number;
  defaultQuoteTemplateId?: string; defaultContractTemplateId?: string; defaultInvoiceTemplateId?: string;
};

type DocumentTemplate = {
  _id?: string; name?: string; documentType?: DocumentType; logoUrl?: string; titleText?: string;
  introText?: string; termsText?: string; footerText?: string; requiredFieldsCsv?: string; active?: boolean;
};

type Reservation = {
  _id?: string; reservationNumber?: string; customerId?: string; customerNumber?: string;
  customerName?: string; customerEmail?: string; customerPhone?: string;
  customerAddressLine1?: string; customerAddressLine2?: string; customerCity?: string; customerRegion?: string;
  customerPostalCode?: string; customerCountry?: string;
  startDateTime?: Date | string; endDateTime?: Date | string; bufferBeforeHours?: number; bufferAfterHours?: number;
  status?: ReservationStatus; workflowStage?: WorkflowStage;
  quoteTemplateId?: string; quoteTemplateName?: string; contractTemplateId?: string; contractTemplateName?: string;
  invoiceTemplateId?: string; invoiceTemplateName?: string;
  subtotalCents?: number; customerDiscountPercent?: number; discountCents?: number; preTaxTotalCents?: number;
  tax1Name?: string; tax1Rate?: number; tax1Cents?: number; tax2Name?: string; tax2Rate?: number;
  tax2Cents?: number; taxTotalCents?: number; totalCents?: number; currency?: string;
  depositRequired?: boolean; depositType?: DepositType; depositValue?: number; depositAmountCents?: number;
  amountDueNowCents?: number; balanceDueCents?: number; paymentMode?: PaymentMode;
  checkoutDateTime?: Date | string; returnDateTime?: Date | string; closedDateTime?: Date | string;
  notes?: string; _createdDate?: Date | string; _updatedDate?: Date | string;
};

type ReservationItem = {
  _id?: string; reservationId?: string; reservationNumber?: string; assetId?: string; assetNumber?: string;
  assetTitle?: string; startDateTime?: Date | string; endDateTime?: Date | string;
  blockedStartDateTime?: Date | string; blockedEndDateTime?: Date | string; bufferBeforeHours?: number;
  bufferAfterHours?: number; billableDays?: number; lineTotalCents?: number; pricingMode?: string;
  currency?: string; status?: ReservationStatus;
};

type RentalDocument = {
  _id?: string; reservationId?: string; reservationNumber?: string; documentNumber?: string;
  documentType?: DocumentType; status?: string; templateId?: string; templateName?: string;
  logoUrl?: string; titleText?: string; introText?: string; termsText?: string; footerText?: string;
  requiredFieldsCsv?: string; snapshotJson?: string; subtotalCents?: number; discountCents?: number;
  preTaxTotalCents?: number; tax1Name?: string; tax1Cents?: number; tax2Name?: string; tax2Cents?: number;
  amountCents?: number; currency?: string; issuedDate?: Date | string; sentDate?: Date | string;
  acceptedDate?: Date | string; signedDate?: Date | string; dueDate?: Date | string; signerName?: string;
  pdfUrl?: string; notes?: string; _createdDate?: Date | string;
};

type Payment = {
  _id?: string; reservationId?: string; reservationNumber?: string; paymentNumber?: string; paymentType?: PaymentType;
  method?: string; status?: string; amountCents?: number; currency?: string; paymentDate?: Date | string;
  reference?: string; wixPaymentLinkId?: string; wixPaymentUrl?: string; wixCheckoutId?: string;
  wixOrderId?: string; wixTransactionId?: string; wixOnlinePayment?: boolean; remainingBalanceCents?: number;
  notes?: string; _createdDate?: Date | string;
};

type Inspection = {
  _id?: string; reservationId?: string; reservationNumber?: string; inspectionNumber?: string;
  inspectionType?: InspectionType; status?: string; assetId?: string; assetNumber?: string; assetTitle?: string;
  condition?: string; hasDamage?: boolean; damageDescription?: string; damageAmountCents?: number;
  photoUrls?: string; signerName?: string; inspectionDate?: Date | string; notes?: string; _createdDate?: Date | string;
};

type ActivityEntry = {
  _id?: string; reservationId?: string; reservationNumber?: string; actionType?: string;
  description?: string; actor?: string; eventDate?: Date | string; _createdDate?: Date | string;
};

type ReservationForm = {
  customerMode: CustomerMode; customerId: string; newFirstName: string; newLastName: string; newCompanyName: string;
  customerName: string; customerEmail: string; customerPhone: string; customerAddressLine1: string;
  customerAddressLine2: string; customerCity: string; customerRegion: string; customerPostalCode: string;
  customerCountry: string; startDateTime: string; endDateTime: string; bufferBeforeHours: string;
  bufferAfterHours: string; quoteTemplateId: string; contractTemplateId: string; invoiceTemplateId: string;
  paymentMode: PaymentMode; depositType: DepositType; depositValue: string; notes: string;
};

type InspectionForm = {
  inspectionType: InspectionType; assetId: string; condition: string; hasDamage: boolean;
  damageDescription: string; damageAmount: string; photoUrls: string; signerName: string; notes: string;
};

const defaultSettings: AppSettings = {
  settingsKey: 'default', currency: 'CAD', defaultBufferBeforeHours: 0, defaultBufferAfterHours: 0,
  taxesEnabled: true, tax1Name: 'TPS', tax1Rate: 5, tax2Name: 'TVQ', tax2Rate: 9.975, tax2Compound: false,
  defaultDepositEnabled: false, defaultDepositType: 'PERCENT', defaultDepositValue: 25,
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

const stageOrder: WorkflowStage[] = ['RESERVATION', 'QUOTE', 'CONTRACT', 'INVOICE', 'PAYMENT', 'READY', 'RENTED', 'RETURNED', 'COMPLETED'];
const stageLabels: Record<WorkflowStage, string> = {
  RESERVATION: 'Réservation', QUOTE: 'Devis', CONTRACT: 'Contrat', INVOICE: 'Facture', PAYMENT: 'Paiement',
  READY: 'Prêt au départ', RENTED: 'En location', RETURNED: 'Retourné', COMPLETED: 'Clôturé',
};
const documentLabels: Record<DocumentType, string> = { QUOTE: 'Devis', CONTRACT: 'Contrat', INVOICE: 'Facture' };
const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function asDate(value?: Date | string): Date {
  if (value instanceof Date) return value;
  return value ? new Date(value) : new Date(0);
}
function dateTime(value?: Date | string): string {
  const date = asDate(value);
  if (!date.getTime()) return '—';
  return new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
function money(cents = 0, currency = 'CAD'): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency }).format(cents / 100);
}
function numeric(value: string): number {
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) && number >= 0 ? number : 0;
}
function generatedNumber(prefix: string): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `${prefix}-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
}
function customerDisplayName(customer: Customer): string {
  return [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || customer.companyName || 'Client sans nom';
}
function stageAtLeast(current: WorkflowStage | undefined, requested: WorkflowStage): WorkflowStage {
  const currentIndex = stageOrder.indexOf(current || 'RESERVATION');
  const requestedIndex = stageOrder.indexOf(requested);
  return currentIndex >= requestedIndex ? (current || 'RESERVATION') : requested;
}
function dayStart(date: Date): Date { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; }
function dayEnd(date: Date): Date { const d = new Date(date); d.setHours(23, 59, 59, 999); return d; }
function monthCells(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first); start.setDate(first.getDate() - offset); start.setHours(0, 0, 0, 0);
  return Array.from({ length: 42 }, (_, index) => { const d = new Date(start); d.setDate(start.getDate() + index); return d; });
}
function escapeHtml(value = ''): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] || char));
}
function lines(value = ''): string { return escapeHtml(value).replace(/\n/g, '<br>'); }
function priceString(cents: number): string {
  const value = (Math.max(0, cents) / 100).toFixed(2);
  return value.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}
function reservationPayload(reservation: Reservation, changes: Partial<Reservation> = {}) {
  const { _createdDate, _updatedDate, ...rest } = reservation;
  return { ...rest, _id: reservation._id, ...changes };
}

const ReservationsV2Page: FC = () => {
  const [view, setView] = useState<ViewMode>('MONTH');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationItems, setReservationItems] = useState<ReservationItem[]>([]);
  const [documents, setDocuments] = useState<RentalDocument[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [form, setForm] = useState<ReservationForm | null>(null);

  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('DETAILS');
  const [notesDraft, setNotesDraft] = useState('');
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [inspectionForm, setInspectionForm] = useState<InspectionForm>(blankInspection);
  const [processing, setProcessing] = useState(false);

  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [availabilityStart, setAvailabilityStart] = useState('');
  const [availabilityEnd, setAvailabilityEnd] = useState('');
  const [availabilityBefore, setAvailabilityBefore] = useState('0');
  const [availabilityAfter, setAvailabilityAfter] = useState('0');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const results = await Promise.all([
        items.query(ASSETS).limit(1000).find(), items.query(CUSTOMERS).limit(1000).find(),
        items.query(RESERVATIONS).limit(1000).find(), items.query(RESERVATION_ITEMS).limit(1000).find(),
        items.query(DOCUMENTS).limit(1000).find(), items.query(PAYMENTS).limit(1000).find(),
        items.query(INSPECTIONS).limit(1000).find(), items.query(ACTIVITY).limit(1000).find(),
        items.query(TEMPLATES).limit(100).find(), items.query(SETTINGS).eq('settingsKey', 'default').limit(1).find(),
      ]);
      setAssets(results[0].items as Asset[]); setCustomers(results[1].items as Customer[]);
      setReservations(results[2].items as Reservation[]); setReservationItems(results[3].items as ReservationItem[]);
      setDocuments(results[4].items as RentalDocument[]); setPayments(results[5].items as Payment[]);
      setInspections(results[6].items as Inspection[]); setActivity(results[7].items as ActivityEntry[]);
      setTemplates(results[8].items as DocumentTemplate[]);
      setSettings({ ...defaultSettings, ...((results[9].items[0] as AppSettings | undefined) || {}) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les données RentalFlow.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeAssets = useMemo(() => assets.filter((asset) => asset.active !== false && asset.status !== 'INACTIVE'), [assets]);
  const activeCustomers = useMemo(() => customers.filter((customer) => customer.active !== false).sort((a, b) => customerDisplayName(a).localeCompare(customerDisplayName(b), 'fr')), [customers]);
  const activeTemplates = useMemo(() => templates.filter((template) => template.active !== false), [templates]);
  const sortedReservations = useMemo(() => [...reservations].filter((r) => r.status !== 'ERROR').sort((a, b) => asDate(a.startDateTime).getTime() - asDate(b.startDateTime).getTime()), [reservations]);

  const logActivity = async (reservation: Reservation, actionType: string, description: string) => {
    if (!reservation._id) return;
    try {
      await items.insert(ACTIVITY, {
        reservationId: reservation._id,
        reservationNumber: reservation.reservationNumber || '',
        actionType,
        description,
        actor: 'Utilisateur Wix',
        eventDate: new Date(),
      });
    } catch { /* Activity logging must not block the operational action. */ }
  };

  const isAvailable = useCallback((assetId: string, start: Date, end: Date, before: number, after: number) => {
    const requested = getBlockedRange(start, end, before, after);
    return !reservationItems.some((item) => {
      if (item.assetId !== assetId || item.status === 'CANCELLED' || item.status === 'COMPLETED') return false;
      const existingStart = asDate(item.blockedStartDateTime);
      const existingEnd = asDate(item.blockedEndDateTime);
      if (!existingStart.getTime() || !existingEnd.getTime()) return false;
      return rangesOverlap(requested.blockedStart, requested.blockedEnd, existingStart, existingEnd);
    });
  }, [reservationItems]);

  const openNewReservation = () => {
    const depositEnabled = settings.defaultDepositEnabled === true;
    setForm({
      customerMode: 'EXISTING', customerId: '', newFirstName: '', newLastName: '', newCompanyName: '',
      customerName: '', customerEmail: '', customerPhone: '', customerAddressLine1: '', customerAddressLine2: '',
      customerCity: '', customerRegion: '', customerPostalCode: '', customerCountry: 'Canada',
      startDateTime: '', endDateTime: '',
      bufferBeforeHours: String(settings.defaultBufferBeforeHours || 0),
      bufferAfterHours: String(settings.defaultBufferAfterHours || 0),
      quoteTemplateId: settings.defaultQuoteTemplateId || '', contractTemplateId: settings.defaultContractTemplateId || '',
      invoiceTemplateId: settings.defaultInvoiceTemplateId || '',
      paymentMode: depositEnabled ? 'DEPOSIT' : 'NONE',
      depositType: settings.defaultDepositType || 'PERCENT', depositValue: String(settings.defaultDepositValue || 0), notes: '',
    });
    setSelectedAssetIds([]); setFormError(''); setSuccess(''); setFormOpen(true);
  };

  const chooseCustomer = (customerId: string) => {
    if (!form) return;
    const customer = activeCustomers.find((candidate) => candidate._id === customerId);
    setForm({
      ...form, customerId,
      customerName: customer ? customerDisplayName(customer) : '',
      customerEmail: customer?.email || '', customerPhone: customer?.phone || '',
      customerAddressLine1: customer?.addressLine1 || '', customerAddressLine2: customer?.addressLine2 || '',
      customerCity: customer?.city || '', customerRegion: customer?.region || '',
      customerPostalCode: customer?.postalCode || '', customerCountry: customer?.country || 'Canada',
    });
  };

  const chosenTemplates = useMemo(() => {
    if (!form) return [] as DocumentTemplate[];
    return [form.quoteTemplateId, form.contractTemplateId, form.invoiceTemplateId]
      .map((id) => activeTemplates.find((template) => template._id === id))
      .filter((template): template is DocumentTemplate => !!template);
  }, [activeTemplates, form]);

  const requiredFields = useMemo(() => [...new Set(chosenTemplates.flatMap((template) => parseRequiredFields(template.requiredFieldsCsv)))], [chosenTemplates]);
  const isRequired = (key: string) => requiredFields.includes(key);

  const formDates = useMemo(() => {
    if (!form) return { start: null as Date | null, end: null as Date | null, valid: false };
    const start = form.startDateTime ? new Date(form.startDateTime) : null;
    const end = form.endDateTime ? new Date(form.endDateTime) : null;
    return { start, end, valid: !!start && !!end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start };
  }, [form]);

  const formAvailability = useMemo(() => {
    if (!form || !formDates.valid || !formDates.start || !formDates.end) return new Map<string, boolean>();
    const before = numeric(form.bufferBeforeHours); const after = numeric(form.bufferAfterHours);
    return new Map(activeAssets.map((asset) => [asset._id || '', !!asset._id && isAvailable(asset._id, formDates.start!, formDates.end!, before, after)]));
  }, [activeAssets, form, formDates, isAvailable]);

  const pricingLines = useMemo(() => {
    if (!formDates.valid || !formDates.start || !formDates.end) return [];
    return selectedAssetIds.flatMap((id) => {
      const asset = activeAssets.find((candidate) => candidate._id === id);
      if (!asset) return [];
      try {
        return [{ asset, ...calculateRentalPrice(asset, formDates.start!, formDates.end!, { allowWeekly: true, allowMonthly: true, allowLongTermDiscount: true }) }];
      } catch { return []; }
    });
  }, [activeAssets, formDates, selectedAssetIds]);

  const selectedCustomer = useMemo(() => form?.customerId ? activeCustomers.find((customer) => customer._id === form.customerId) : undefined, [activeCustomers, form?.customerId]);
  const subtotalCents = pricingLines.reduce((sum, line) => sum + line.totalCents, 0);
  const discountPercent = form?.customerMode === 'EXISTING' ? selectedCustomer?.discountPercent || 0 : 0;
  const discountCents = Math.round(subtotalCents * discountPercent / 100);
  const preTaxCents = Math.max(0, subtotalCents - discountCents);
  const taxPreview = calculateTaxes(preTaxCents, settings);
  const depositPreview = form ? calculateDeposit(taxPreview.totalCents, form.paymentMode, form.depositType, numeric(form.depositValue)) : calculateDeposit(taxPreview.totalCents, 'NONE', 'PERCENT', 0);
  const currency = pricingLines[0]?.asset.currency || settings.currency || 'CAD';

  const toggleAsset = (id: string) => setSelectedAssetIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  const saveReservation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    setFormError('');
    if (!formDates.valid || !formDates.start || !formDates.end) return setFormError('La période de location est invalide.');
    if (selectedAssetIds.length < 1) return setFormError('Sélectionnez au moins un équipement.');
    if (form.customerMode === 'EXISTING' && !form.customerId) return setFormError('Sélectionnez un client existant.');
    if (form.customerMode === 'NEW' && !form.customerName.trim()) return setFormError('Le nom du nouveau client est obligatoire.');

    const missing = validateRequiredFields(requiredFields, {
      customerName: form.customerName, customerEmail: form.customerEmail, customerPhone: form.customerPhone,
      customerAddressLine1: form.customerAddressLine1, customerCity: form.customerCity, customerRegion: form.customerRegion,
      customerPostalCode: form.customerPostalCode, customerCountry: form.customerCountry,
      startDateTime: form.startDateTime, endDateTime: form.endDateTime, selectedAssetCount: selectedAssetIds.length,
    });
    if (missing.length) return setFormError(`Champs requis par les modèles sélectionnés : ${missing.join(', ')}.`);

    const before = numeric(form.bufferBeforeHours); const after = numeric(form.bufferAfterHours);
    setSaving(true);
    try {
      const latest = (await items.query(RESERVATION_ITEMS).limit(1000).find()).items as ReservationItem[];
      const blocked = getBlockedRange(formDates.start, formDates.end, before, after);
      for (const assetId of selectedAssetIds) {
        const conflict = latest.some((item) => item.assetId === assetId && item.status !== 'CANCELLED' && item.status !== 'COMPLETED' && rangesOverlap(blocked.blockedStart, blocked.blockedEnd, asDate(item.blockedStartDateTime), asDate(item.blockedEndDateTime)));
        if (conflict) throw new Error(`${activeAssets.find((asset) => asset._id === assetId)?.title || 'Un équipement'} n’est plus disponible pour cette période.`);
      }

      let customerId = form.customerId;
      let customerNumber = selectedCustomer?.customerNumber || '';
      if (form.customerMode === 'NEW') {
        const created = await items.insert(CUSTOMERS, {
          customerNumber: generatedNumber('C'), firstName: form.newFirstName.trim(), lastName: form.newLastName.trim(),
          companyName: form.newCompanyName.trim(), email: form.customerEmail.trim().toLowerCase(), phone: form.customerPhone.trim(),
          addressLine1: form.customerAddressLine1.trim(), addressLine2: form.customerAddressLine2.trim(), city: form.customerCity.trim(),
          region: form.customerRegion.trim(), postalCode: form.customerPostalCode.trim().toUpperCase(), country: form.customerCountry.trim(),
          discountPercent: 0, active: true,
        }) as Customer;
        if (!created._id) throw new Error('Impossible de créer le client.');
        customerId = created._id; customerNumber = created.customerNumber || '';
      }

      const number = generatedNumber('RF');
      const quoteTemplate = activeTemplates.find((template) => template._id === form.quoteTemplateId);
      const contractTemplate = activeTemplates.find((template) => template._id === form.contractTemplateId);
      const invoiceTemplate = activeTemplates.find((template) => template._id === form.invoiceTemplateId);
      const created = await items.insert(RESERVATIONS, {
        reservationNumber: number, customerId, customerNumber,
        customerName: form.customerName.trim(), customerEmail: form.customerEmail.trim(), customerPhone: form.customerPhone.trim(),
        customerAddressLine1: form.customerAddressLine1.trim(), customerAddressLine2: form.customerAddressLine2.trim(),
        customerCity: form.customerCity.trim(), customerRegion: form.customerRegion.trim(),
        customerPostalCode: form.customerPostalCode.trim().toUpperCase(), customerCountry: form.customerCountry.trim(),
        startDateTime: formDates.start, endDateTime: formDates.end, bufferBeforeHours: before, bufferAfterHours: after,
        status: 'CONFIRMED', workflowStage: 'RESERVATION',
        quoteTemplateId: quoteTemplate?._id || '', quoteTemplateName: quoteTemplate?.name || '',
        contractTemplateId: contractTemplate?._id || '', contractTemplateName: contractTemplate?.name || '',
        invoiceTemplateId: invoiceTemplate?._id || '', invoiceTemplateName: invoiceTemplate?.name || '',
        subtotalCents, customerDiscountPercent: discountPercent, discountCents,
        preTaxTotalCents: taxPreview.preTaxTotalCents,
        tax1Name: settings.taxesEnabled === false ? '' : settings.tax1Name || '', tax1Rate: settings.taxesEnabled === false ? 0 : settings.tax1Rate || 0, tax1Cents: taxPreview.tax1Cents,
        tax2Name: settings.taxesEnabled === false ? '' : settings.tax2Name || '', tax2Rate: settings.taxesEnabled === false ? 0 : settings.tax2Rate || 0, tax2Cents: taxPreview.tax2Cents,
        taxTotalCents: taxPreview.taxTotalCents, totalCents: taxPreview.totalCents, currency,
        depositRequired: form.paymentMode === 'DEPOSIT', depositType: form.depositType, depositValue: numeric(form.depositValue),
        depositAmountCents: depositPreview.depositAmountCents, amountDueNowCents: depositPreview.amountDueNowCents,
        balanceDueCents: depositPreview.balanceDueCents, paymentMode: form.paymentMode, notes: form.notes.trim(),
      }) as Reservation;
      if (!created._id) throw new Error('Wix n’a pas retourné l’identifiant de la réservation.');

      for (const line of pricingLines) {
        if (!line.asset._id) continue;
        await items.insert(RESERVATION_ITEMS, {
          reservationId: created._id, reservationNumber: number, assetId: line.asset._id,
          assetNumber: line.asset.assetNumber || '', assetTitle: line.asset.title || '',
          startDateTime: formDates.start, endDateTime: formDates.end,
          blockedStartDateTime: blocked.blockedStart, blockedEndDateTime: blocked.blockedEnd,
          bufferBeforeHours: before, bufferAfterHours: after, billableDays: line.billableDays,
          lineTotalCents: line.totalCents, pricingMode: line.pricingMode, currency: line.asset.currency || currency, status: 'CONFIRMED',
        });
      }
      await logActivity(created, 'RESERVATION_CREATED', `Réservation ${number} créée.`);
      setFormOpen(false); setForm(null); setSuccess(`Réservation ${number} créée.`); await load();
      setSelectedReservation(created); setNotesDraft(created.notes || ''); setDetailTab('DETAILS');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Impossible de créer la réservation.');
    } finally { setSaving(false); }
  };

  const openReservation = (reservation: Reservation) => {
    setSelectedReservation(reservation); setNotesDraft(reservation.notes || ''); setDetailTab('DETAILS'); setSuccess(''); setError('');
  };

  const updateReservation = async (reservation: Reservation, changes: Partial<Reservation>, action: string, description: string) => {
    if (!reservation._id) return;
    setProcessing(true); setError('');
    try {
      const updated = await items.update(RESERVATIONS, reservationPayload(reservation, changes)) as Reservation;
      await logActivity(updated, action, description);
      setSelectedReservation(updated); setNotesDraft(updated.notes || ''); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible de modifier la réservation.'); }
    finally { setProcessing(false); }
  };

  const cancelReservation = async (reservation: Reservation) => {
    if (!reservation._id || !window.confirm(`Annuler ${reservation.reservationNumber || 'cette réservation'} ?`)) return;
    setProcessing(true);
    try {
      const updated = await items.update(RESERVATIONS, reservationPayload(reservation, { status: 'CANCELLED' })) as Reservation;
      for (const item of reservationItems.filter((row) => row.reservationId === reservation._id && row._id)) {
        await items.update(RESERVATION_ITEMS, { ...item, status: 'CANCELLED' });
      }
      await logActivity(updated, 'RESERVATION_CANCELLED', 'Réservation annulée; disponibilité libérée.');
      setSelectedReservation(updated); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d’annuler la réservation.'); }
    finally { setProcessing(false); }
  };

  const linkedItems = selectedReservation ? reservationItems.filter((row) => row.reservationId === selectedReservation._id) : [];
  const linkedDocuments = selectedReservation ? documents.filter((row) => row.reservationId === selectedReservation._id) : [];
  const linkedPayments = selectedReservation ? payments.filter((row) => row.reservationId === selectedReservation._id) : [];
  const linkedInspections = selectedReservation ? inspections.filter((row) => row.reservationId === selectedReservation._id) : [];
  const linkedActivity = selectedReservation ? activity.filter((row) => row.reservationId === selectedReservation._id).sort((a, b) => asDate(b.eventDate || b._createdDate).getTime() - asDate(a.eventDate || a._createdDate).getTime()) : [];
  const paidCents = linkedPayments.filter((payment) => payment.status === 'PAID' && (payment.paymentType === 'PAYMENT' || payment.paymentType === 'BOOKING_DEPOSIT')).reduce((sum, payment) => sum + (payment.amountCents || 0), 0);
  const liveBalance = selectedReservation ? Math.max(0, (selectedReservation.totalCents || 0) - paidCents) : 0;
  const initialDue = selectedReservation ? Math.min(liveBalance, selectedReservation.amountDueNowCents || liveBalance) : 0;

  const templateForDocument = (type: DocumentType, reservation: Reservation): DocumentTemplate | undefined => {
    const id = type === 'QUOTE' ? reservation.quoteTemplateId : type === 'CONTRACT' ? reservation.contractTemplateId : reservation.invoiceTemplateId;
    return activeTemplates.find((template) => template._id === id);
  };

  const createDocument = async (type: DocumentType) => {
    if (!selectedReservation?._id) return;
    const template = templateForDocument(type, selectedReservation);
    if (!template) return setError(`Aucun modèle ${documentLabels[type].toLowerCase()} n’est sélectionné sur cette réservation.`);
    setProcessing(true); setError('');
    try {
      const prefix = type === 'QUOTE' ? 'DEV' : type === 'CONTRACT' ? 'CTR' : 'FAC';
      const snapshot = {
        reservation: selectedReservation,
        equipment: linkedItems.map((item) => ({ assetNumber: item.assetNumber, assetTitle: item.assetTitle, billableDays: item.billableDays, lineTotalCents: item.lineTotalCents, pricingMode: item.pricingMode })),
      };
      const document = await items.insert(DOCUMENTS, {
        reservationId: selectedReservation._id, reservationNumber: selectedReservation.reservationNumber || '',
        documentNumber: generatedNumber(prefix), documentType: type, status: 'DRAFT',
        templateId: template._id || '', templateName: template.name || '', logoUrl: template.logoUrl || settings.logoUrl || '',
        titleText: template.titleText || documentLabels[type], introText: template.introText || '', termsText: template.termsText || '',
        footerText: template.footerText || '', requiredFieldsCsv: template.requiredFieldsCsv || '', snapshotJson: JSON.stringify(snapshot),
        subtotalCents: selectedReservation.subtotalCents || 0, discountCents: selectedReservation.discountCents || 0,
        preTaxTotalCents: selectedReservation.preTaxTotalCents || 0, tax1Name: selectedReservation.tax1Name || '', tax1Cents: selectedReservation.tax1Cents || 0,
        tax2Name: selectedReservation.tax2Name || '', tax2Cents: selectedReservation.tax2Cents || 0,
        amountCents: selectedReservation.totalCents || 0, currency: selectedReservation.currency || 'CAD', issuedDate: new Date(), notes: '',
      }) as RentalDocument;
      const nextStage: WorkflowStage = type === 'QUOTE' ? 'QUOTE' : type === 'CONTRACT' ? 'CONTRACT' : 'INVOICE';
      await updateReservation(selectedReservation, { workflowStage: stageAtLeast(selectedReservation.workflowStage, nextStage) }, 'DOCUMENT_CREATED', `${documentLabels[type]} ${document.documentNumber || ''} créé.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible de créer le document.'); }
    finally { setProcessing(false); }
  };

  const updateDocumentStatus = async (document: RentalDocument, action: 'ACCEPT' | 'SIGN' | 'ISSUE') => {
    if (!document._id || !selectedReservation) return;
    setProcessing(true); setError('');
    try {
      const changes = action === 'ACCEPT'
        ? { status: 'ACCEPTED', acceptedDate: new Date() }
        : action === 'SIGN'
          ? { status: 'SIGNED', signedDate: new Date(), signerName: selectedReservation.customerName || '' }
          : { status: 'ISSUED', sentDate: new Date() };
      await items.update(DOCUMENTS, { ...document, ...changes });
      const requested: WorkflowStage = document.documentType === 'QUOTE' ? 'QUOTE' : document.documentType === 'CONTRACT' ? 'CONTRACT' : 'INVOICE';
      await updateReservation(selectedReservation, { workflowStage: stageAtLeast(selectedReservation.workflowStage, requested) }, 'DOCUMENT_UPDATED', `${documentLabels[document.documentType || 'QUOTE']} ${document.documentNumber || ''} : ${changes.status}.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible de mettre à jour le document.'); }
    finally { setProcessing(false); }
  };

  const printDocument = (document: RentalDocument) => {
    if (!selectedReservation) return;
    let snapshotItems = linkedItems;
    try {
      const parsed = JSON.parse(document.snapshotJson || '{}') as { equipment?: ReservationItem[] };
      if (Array.isArray(parsed.equipment)) snapshotItems = parsed.equipment;
    } catch { /* Use current linked items. */ }
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) return setError('Le navigateur a bloqué la fenêtre du document. Autorisez les fenêtres contextuelles pour imprimer.');
    const logo = document.logoUrl ? `<img src="${escapeHtml(document.logoUrl)}" style="max-height:90px;max-width:220px;object-fit:contain">` : '';
    const equipmentRows = snapshotItems.map((item) => `<tr><td>${escapeHtml(item.assetTitle || '')}</td><td>${escapeHtml(item.assetNumber || '')}</td><td>${item.billableDays || 0}</td><td style="text-align:right">${escapeHtml(money(item.lineTotalCents || 0, document.currency || 'CAD'))}</td></tr>`).join('');
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(document.documentNumber || 'Document')}</title><style>body{font-family:Arial,sans-serif;color:#172033;max-width:900px;margin:30px auto;padding:20px}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #172033;padding-bottom:18px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}.totals{margin-left:auto;margin-top:24px;max-width:360px}.row{display:flex;justify-content:space-between;padding:6px 0}.total{font-size:19px;font-weight:bold;border-top:2px solid #222;margin-top:6px;padding-top:10px}.muted{color:#64748b}.terms{margin-top:30px;line-height:1.5}.footer{margin-top:40px;border-top:1px solid #ddd;padding-top:14px;color:#64748b;font-size:12px}@media print{button{display:none}}</style></head><body><header><div>${logo}<div class="muted">${escapeHtml(settings.companyName || 'RentalFlow')}</div></div><div style="text-align:right"><h1>${escapeHtml(document.titleText || documentLabels[document.documentType || 'QUOTE'])}</h1><strong>${escapeHtml(document.documentNumber || '')}</strong><div>${dateTime(document.issuedDate)}</div></div></header><section><h3>Client</h3><strong>${escapeHtml(selectedReservation.customerName || '')}</strong><div>${escapeHtml(selectedReservation.customerEmail || '')}</div><div>${escapeHtml(selectedReservation.customerPhone || '')}</div><div>${escapeHtml([selectedReservation.customerAddressLine1, selectedReservation.customerAddressLine2, selectedReservation.customerCity, selectedReservation.customerRegion, selectedReservation.customerPostalCode, selectedReservation.customerCountry].filter(Boolean).join(', '))}</div></section><p>${lines(document.introText || '')}</p><div><strong>Période :</strong> ${dateTime(selectedReservation.startDateTime)} → ${dateTime(selectedReservation.endDateTime)}</div><table><thead><tr><th>Équipement</th><th>No</th><th>Jours</th><th style="text-align:right">Montant</th></tr></thead><tbody>${equipmentRows}</tbody></table><div class="totals"><div class="row"><span>Sous-total</span><span>${money(document.subtotalCents || 0, document.currency || 'CAD')}</span></div>${(document.discountCents || 0) > 0 ? `<div class="row"><span>Rabais</span><span>-${money(document.discountCents || 0, document.currency || 'CAD')}</span></div>` : ''}<div class="row"><span>${escapeHtml(document.tax1Name || 'Taxe 1')}</span><span>${money(document.tax1Cents || 0, document.currency || 'CAD')}</span></div><div class="row"><span>${escapeHtml(document.tax2Name || 'Taxe 2')}</span><span>${money(document.tax2Cents || 0, document.currency || 'CAD')}</span></div><div class="row total"><span>Total</span><span>${money(document.amountCents || 0, document.currency || 'CAD')}</span></div></div><div class="terms">${lines(document.termsText || '')}</div>${document.signerName ? `<p><strong>Signataire :</strong> ${escapeHtml(document.signerName)}</p>` : ''}<div class="footer">${lines(document.footerText || '')}</div><button onclick="window.print()">Imprimer / Enregistrer en PDF</button></body></html>`);
    popup.document.close();
  };

  const createWixPaymentLink = async () => {
    if (!selectedReservation?._id || liveBalance <= 0) return;
    const amount = paidCents === 0 && initialDue > 0 ? initialDue : liveBalance;
    if (amount <= 0) return setError('Aucun montant à percevoir.');
    setProcessing(true); setError('');
    try {
      const wixGetPaid = (await import('@wix/get-paid')) as any;
      const api = wixGetPaid.paymentLinks;
      if (!api?.createPaymentLink) throw new Error('Le module Wix Payment Links n’est pas disponible.');
      const label = selectedReservation.paymentMode === 'DEPOSIT' && paidCents === 0 ? 'Dépôt de réservation' : 'Paiement de location';
      const response = await api.createPaymentLink({
        title: `${selectedReservation.reservationNumber || 'RentalFlow'} — ${label}`,
        description: `Paiement RentalFlow pour ${selectedReservation.customerName || 'client'}`,
        currency: selectedReservation.currency || 'CAD',
        type: 'ECOM', paymentsLimit: 1, displayData: {},
        ecomPaymentLink: {
          lineItems: [{ type: 'CUSTOM', customItem: { name: `${label} ${selectedReservation.reservationNumber || ''}`, quantity: 1, price: priceString(amount) } }],
        },
      });
      const link = response?.paymentLink || response;
      const linkId = link?._id || link?.id;
      if (!linkId) throw new Error('Wix n’a pas retourné l’identifiant du lien de paiement.');

      let checkoutUrl = link?.links?.find?.((entry: any) => entry?.url?.url)?.url?.url || link?.links?.find?.((entry: any) => typeof entry?.url === 'string')?.url || link?.url?.url || link?.url || '';
      let checkoutId = '';
      if (!checkoutUrl && api.initiatePayment) {
        const initiated = await api.initiatePayment(linkId);
        checkoutUrl = initiated?.ecomCheckout?.checkoutUrl || initiated?.checkoutUrl || '';
        checkoutId = initiated?.ecomCheckout?.checkoutId || initiated?.checkoutId || '';
      }

      const payment = await items.insert(PAYMENTS, {
        reservationId: selectedReservation._id, reservationNumber: selectedReservation.reservationNumber || '',
        paymentNumber: generatedNumber('PAY'), paymentType: selectedReservation.paymentMode === 'DEPOSIT' && paidCents === 0 ? 'BOOKING_DEPOSIT' : 'PAYMENT',
        method: 'WIX', status: 'PENDING', amountCents: amount, currency: selectedReservation.currency || 'CAD',
        paymentDate: new Date(), reference: label, wixPaymentLinkId: linkId, wixPaymentUrl: checkoutUrl,
        wixCheckoutId: checkoutId, wixOnlinePayment: true, remainingBalanceCents: Math.max(0, liveBalance - amount),
        notes: 'Lien de paiement Wix créé par RentalFlow.',
      }) as Payment;
      await logActivity(selectedReservation, 'WIX_PAYMENT_LINK_CREATED', `${label} ${money(amount, selectedReservation.currency || 'CAD')} — lien Wix créé.`);
      await load();
      if (checkoutUrl) window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      else setSuccess(`Lien Wix ${payment.wixPaymentLinkId || ''} créé. Utilisez Actualiser le statut pour le suivre.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de créer le lien de paiement Wix. Vérifiez le droit Manage Paylinks et les moyens de paiement du site.');
    } finally { setProcessing(false); }
  };

  const refreshWixPayment = async (payment: Payment) => {
    if (!payment._id || !payment.wixPaymentLinkId) return;
    setProcessing(true); setError('');
    try {
      const wixGetPaid = (await import('@wix/get-paid')) as any;
      const api = wixGetPaid.paymentLinks;
      if (!api?.getPaymentLink) throw new Error('Le module Wix Payment Links n’est pas disponible.');
      const response = await api.getPaymentLink(payment.wixPaymentLinkId);
      const link = response?.paymentLink || response;
      const wixStatus = String(link?.status || '').toUpperCase();
      const paid = wixStatus === 'PAID';
      await items.update(PAYMENTS, { ...payment, status: paid ? 'PAID' : payment.status || 'PENDING', paymentDate: paid ? new Date() : payment.paymentDate });
      if (paid && selectedReservation) {
        await logActivity(selectedReservation, 'PAYMENT_CONFIRMED', `Paiement Wix ${payment.paymentNumber || ''} confirmé.`);
        await updateReservation(selectedReservation, { workflowStage: stageAtLeast(selectedReservation.workflowStage, 'PAYMENT') }, 'WORKFLOW_PAYMENT', 'Étape paiement atteinte.');
      }
      await load();
      setSuccess(paid ? 'Paiement Wix confirmé.' : `Statut Wix : ${wixStatus || 'en attente'}.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d’actualiser le paiement Wix.'); }
    finally { setProcessing(false); }
  };

  const saveNotes = async () => {
    if (!selectedReservation) return;
    await updateReservation(selectedReservation, { notes: notesDraft }, 'NOTES_UPDATED', 'Notes de la réservation modifiées.');
  };

  const saveInspection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedReservation?._id) return;
    const asset = linkedItems.find((item) => item.assetId === inspectionForm.assetId);
    if (!asset) return setError('Sélectionnez un équipement de la réservation.');
    setProcessing(true); setError('');
    try {
      const damage = Math.round(numeric(inspectionForm.damageAmount) * 100);
      await items.insert(INSPECTIONS, {
        reservationId: selectedReservation._id, reservationNumber: selectedReservation.reservationNumber || '',
        inspectionNumber: generatedNumber(inspectionForm.inspectionType === 'DEPARTURE' ? 'INS-D' : 'INS-R'),
        inspectionType: inspectionForm.inspectionType, status: 'COMPLETED', assetId: asset.assetId || '',
        assetNumber: asset.assetNumber || '', assetTitle: asset.assetTitle || '', condition: inspectionForm.condition,
        hasDamage: inspectionForm.hasDamage, damageDescription: inspectionForm.damageDescription.trim(),
        damageAmountCents: inspectionForm.hasDamage ? damage : 0, photoUrls: inspectionForm.photoUrls.trim(),
        signerName: inspectionForm.signerName.trim(), inspectionDate: new Date(), notes: inspectionForm.notes.trim(),
      });
      if (inspectionForm.hasDamage && damage > 0) {
        await items.insert(PAYMENTS, {
          reservationId: selectedReservation._id, reservationNumber: selectedReservation.reservationNumber || '',
          paymentNumber: generatedNumber('DMG'), paymentType: 'DAMAGE_CHARGE', method: 'PENDING', status: 'PENDING',
          amountCents: damage, currency: selectedReservation.currency || 'CAD', paymentDate: new Date(),
          reference: `Dommage ${asset.assetNumber || ''}`, wixOnlinePayment: false, remainingBalanceCents: damage,
          notes: inspectionForm.damageDescription.trim(),
        });
      }
      await logActivity(selectedReservation, 'INSPECTION_COMPLETED', `Inspection ${inspectionForm.inspectionType === 'DEPARTURE' ? 'départ' : 'retour'} — ${asset.assetTitle || asset.assetNumber || ''}.`);
      setInspectionOpen(false); setInspectionForm(blankInspection); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d’enregistrer l’inspection.'); }
    finally { setProcessing(false); }
  };

  const checkout = async () => {
    if (!selectedReservation) return;
    const hasDeparture = linkedInspections.some((inspection) => inspection.inspectionType === 'DEPARTURE' && inspection.status === 'COMPLETED');
    if (!hasDeparture) return setError('Une inspection de départ complétée est requise avant de confirmer le départ.');
    await updateReservation(selectedReservation, { status: 'RENTED', workflowStage: 'RENTED', checkoutDateTime: new Date() }, 'CHECKOUT', 'Départ confirmé; réservation en location.');
  };

  const returnRental = async () => {
    if (!selectedReservation) return;
    const hasReturn = linkedInspections.some((inspection) => inspection.inspectionType === 'RETURN' && inspection.status === 'COMPLETED');
    if (!hasReturn) return setError('Une inspection de retour complétée est requise avant de confirmer le retour.');
    await updateReservation(selectedReservation, { status: 'RETURNED', workflowStage: 'RETURNED', returnDateTime: new Date() }, 'RETURN', 'Retour confirmé.');
  };

  const closeRental = async () => {
    if (!selectedReservation) return;
    await updateReservation(selectedReservation, { status: 'COMPLETED', workflowStage: 'COMPLETED', closedDateTime: new Date() }, 'CLOSED', 'Réservation clôturée.');
    for (const item of linkedItems.filter((item) => item._id)) await items.update(RESERVATION_ITEMS, { ...item, status: 'COMPLETED' });
    await load();
  };

  const availabilityResult = useMemo(() => {
    if (!availabilityStart || !availabilityEnd) return null;
    const start = new Date(availabilityStart); const end = new Date(availabilityEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
    return activeAssets.map((asset) => ({ asset, available: !!asset._id && isAvailable(asset._id, start, end, numeric(availabilityBefore), numeric(availabilityAfter)) }));
  }, [activeAssets, availabilityAfter, availabilityBefore, availabilityEnd, availabilityStart, isAvailable]);

  const monthDays = useMemo(() => monthCells(monthCursor), [monthCursor]);
  const reservationsForDay = (day: Date) => sortedReservations.filter((reservation) => {
    if (reservation.status === 'CANCELLED') return false;
    const start = asDate(reservation.startDateTime); const end = asDate(reservation.endDateTime);
    return start <= dayEnd(day) && end >= dayStart(day);
  });

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header title="Réservations" subtitle="Réservez, facturez, encaissez et suivez chaque location de bout en bout." />
        <Page.Content>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 50 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <ViewButton active={view === 'MONTH'} onClick={() => setView('MONTH')}>Mois</ViewButton>
                <ViewButton active={view === 'LIST'} onClick={() => setView('LIST')}>Liste</ViewButton>
                <ViewButton active={view === 'AVAILABILITY'} onClick={() => setView('AVAILABILITY')}>Disponibilité</ViewButton>
              </div>
              <button style={primary} onClick={openNewReservation}>+ Nouvelle réservation</button>
            </div>
            {error && <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>{error}</div>}
            {success && <div style={{ ...card, background: '#f0fdf4', borderColor: '#86efac', color: '#166534' }}>{success}</div>}

            {loading ? <div style={card}>Chargement…</div> : null}

            {!loading && view === 'MONTH' && (
              <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <button style={secondary} onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}>‹</button>
                  <h2 style={{ margin: 0, textTransform: 'capitalize' }}>{new Intl.DateTimeFormat('fr-CA', { month: 'long', year: 'numeric' }).format(monthCursor)}</h2>
                  <button style={secondary} onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}>›</button>
                </div>
                <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 980 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: '#f8fafc', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{weekdays.map((day) => <div key={day} style={{ padding: 9, textAlign: 'center', fontWeight: 700, fontSize: 13 }}>{day}</div>)}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>{monthDays.map((day, index) => {
                    const dayReservations = reservationsForDay(day); const inMonth = day.getMonth() === monthCursor.getMonth(); const today = dayStart(day).getTime() === dayStart(new Date()).getTime();
                    return <div key={day.toISOString()} style={{ minHeight: 132, padding: 7, borderRight: (index + 1) % 7 === 0 ? 0 : '1px solid #e5e7eb', borderBottom: index >= 35 ? 0 : '1px solid #e5e7eb', background: inMonth ? '#fff' : '#f8fafc' }}><div style={{ width: 28, height: 28, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: today ? '#116dff' : 'transparent', color: today ? '#fff' : inMonth ? '#0f172a' : '#94a3b8', fontWeight: today ? 700 : 500 }}>{day.getDate()}</div><div style={{ display: 'grid', gap: 4, marginTop: 4 }}>{dayReservations.slice(0, 4).map((reservation) => <button key={reservation._id || reservation.reservationNumber} onClick={() => openReservation(reservation)} style={{ border: '1px solid #ddd6fe', background: reservation.status === 'RENTED' ? '#eff6ff' : reservation.status === 'RETURNED' || reservation.status === 'COMPLETED' ? '#f0fdf4' : '#f5f3ff', borderRadius: 6, padding: '4px 5px', textAlign: 'left', fontSize: 11, cursor: 'pointer', overflow: 'hidden' }}><strong style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{reservation.reservationNumber}</strong><span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{reservation.customerName}</span></button>)}{dayReservations.length > 4 ? <span style={{ fontSize: 11, color: '#64748b' }}>+ {dayReservations.length - 4}</span> : null}</div></div>;
                  })}</div>
                </div></div>
              </div>
            )}

            {!loading && view === 'LIST' && <ReservationList reservations={sortedReservations} onOpen={openReservation} />}

            {!loading && view === 'AVAILABILITY' && (
              <div style={card}>
                <h2 style={{ marginTop: 0 }}>Recherche de disponibilité</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
                  <Field label="Début"><input type="datetime-local" style={input} value={availabilityStart} onChange={(e) => setAvailabilityStart(e.target.value)} /></Field>
                  <Field label="Fin"><input type="datetime-local" style={input} value={availabilityEnd} onChange={(e) => setAvailabilityEnd(e.target.value)} /></Field>
                  <Field label="Buffer avant (h)"><input type="number" min="0" step="0.5" style={input} value={availabilityBefore} onChange={(e) => setAvailabilityBefore(e.target.value)} /></Field>
                  <Field label="Buffer après (h)"><input type="number" min="0" step="0.5" style={input} value={availabilityAfter} onChange={(e) => setAvailabilityAfter(e.target.value)} /></Field>
                </div>
                <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>{availabilityResult?.map(({ asset, available }) => <div key={asset._id} style={{ border: `1px solid ${available ? '#86efac' : '#fecaca'}`, background: available ? '#f0fdf4' : '#fef2f2', borderRadius: 9, padding: 12 }}><strong>{asset.title}</strong><div style={{ color: '#64748b' }}>{asset.assetNumber}</div><div style={{ marginTop: 6, fontWeight: 700 }}>{available ? 'Disponible' : 'Indisponible'}</div></div>)}</div>
              </div>
            )}
          </div>
        </Page.Content>
      </Page>

      {formOpen && form && (
        <div onMouseDown={() => !saving && setFormOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 18 }}>
          <div onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 1050, maxHeight: '94vh', overflowY: 'auto', background: '#fff', borderRadius: 14 }}>
            <form onSubmit={saveReservation}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}><div><h2 style={{ margin: 0 }}>Nouvelle réservation</h2><div style={{ color: '#64748b', marginTop: 4 }}>Les champs obligatoires sont déterminés par les modèles de documents sélectionnés.</div></div><button type="button" disabled={saving} onClick={() => setFormOpen(false)} style={{ border: 0, background: 'transparent', fontSize: 26 }}>×</button></div>
              <div style={{ padding: 24 }}>
                {formError && <div style={{ background: '#fef2f2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 16 }}>{formError}</div>}
                <h3>Client</h3>
                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}><label><input type="radio" checked={form.customerMode === 'EXISTING'} onChange={() => setForm({ ...form, customerMode: 'EXISTING' })} /> Client existant</label><label><input type="radio" checked={form.customerMode === 'NEW'} onChange={() => setForm({ ...form, customerMode: 'NEW', customerId: '' })} /> Nouveau client</label></div>
                {form.customerMode === 'EXISTING' ? <Field label="Client *"><select style={input} value={form.customerId} onChange={(e) => chooseCustomer(e.target.value)}><option value="">Sélectionner…</option>{activeCustomers.map((customer) => <option key={customer._id} value={customer._id}>{customerDisplayName(customer)} · {customer.customerNumber || ''}</option>)}</select></Field> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}><Field label="Prénom"><input style={input} value={form.newFirstName} onChange={(e) => { const first = e.target.value; setForm({ ...form, newFirstName: first, customerName: [first, form.newLastName].filter(Boolean).join(' ').trim() || form.newCompanyName }); }} /></Field><Field label="Nom"><input style={input} value={form.newLastName} onChange={(e) => { const last = e.target.value; setForm({ ...form, newLastName: last, customerName: [form.newFirstName, last].filter(Boolean).join(' ').trim() || form.newCompanyName }); }} /></Field><Field label="Entreprise"><input style={input} value={form.newCompanyName} onChange={(e) => { const company = e.target.value; setForm({ ...form, newCompanyName: company, customerName: [form.newFirstName, form.newLastName].filter(Boolean).join(' ').trim() || company }); }} /></Field></div>}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12, marginTop: 14 }}>
                  <Field label={`Nom affiché${isRequired('CUSTOMER_NAME') ? ' *' : ''}`}><input style={input} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></Field>
                  <Field label={`Courriel${isRequired('CUSTOMER_EMAIL') ? ' *' : ''}`}><input type="email" style={input} value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} /></Field>
                  <Field label={`Téléphone${isRequired('CUSTOMER_PHONE') ? ' *' : ''}`}><input style={input} value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} /></Field>
                  <Field label={`Adresse${isRequired('CUSTOMER_ADDRESS') ? ' *' : ''}`}><input style={input} value={form.customerAddressLine1} onChange={(e) => setForm({ ...form, customerAddressLine1: e.target.value })} /></Field>
                  <Field label="Adresse 2"><input style={input} value={form.customerAddressLine2} onChange={(e) => setForm({ ...form, customerAddressLine2: e.target.value })} /></Field>
                  <Field label={`Ville${isRequired('CUSTOMER_ADDRESS') ? ' *' : ''}`}><input style={input} value={form.customerCity} onChange={(e) => setForm({ ...form, customerCity: e.target.value })} /></Field>
                  <Field label={`Province / État${isRequired('CUSTOMER_ADDRESS') ? ' *' : ''}`}><input style={input} value={form.customerRegion} onChange={(e) => setForm({ ...form, customerRegion: e.target.value })} /></Field>
                  <Field label={`Code postal${isRequired('CUSTOMER_ADDRESS') ? ' *' : ''}`}><input style={input} value={form.customerPostalCode} onChange={(e) => setForm({ ...form, customerPostalCode: e.target.value })} /></Field>
                  <Field label={`Pays${isRequired('CUSTOMER_ADDRESS') ? ' *' : ''}`}><input style={input} value={form.customerCountry} onChange={(e) => setForm({ ...form, customerCountry: e.target.value })} /></Field>
                </div>

                <h3 style={{ marginTop: 24 }}>Modèles de documents</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 }}>
                  <TemplatePicker label="Modèle de devis" type="QUOTE" value={form.quoteTemplateId} templates={activeTemplates} onChange={(value) => setForm({ ...form, quoteTemplateId: value })} />
                  <TemplatePicker label="Modèle de contrat" type="CONTRACT" value={form.contractTemplateId} templates={activeTemplates} onChange={(value) => setForm({ ...form, contractTemplateId: value })} />
                  <TemplatePicker label="Modèle de facture" type="INVOICE" value={form.invoiceTemplateId} templates={activeTemplates} onChange={(value) => setForm({ ...form, invoiceTemplateId: value })} />
                </div>
                {requiredFields.length ? <div style={{ marginTop: 9, fontSize: 13, color: '#64748b' }}>Champs exigés par les modèles : {requiredFields.join(', ')}</div> : null}

                <h3 style={{ marginTop: 24 }}>Période</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}><Field label="Début *"><input type="datetime-local" style={input} value={form.startDateTime} onChange={(e) => setForm({ ...form, startDateTime: e.target.value })} /></Field><Field label="Fin *"><input type="datetime-local" style={input} value={form.endDateTime} onChange={(e) => setForm({ ...form, endDateTime: e.target.value })} /></Field><Field label="Buffer avant (h)"><input type="number" min="0" step="0.5" style={input} value={form.bufferBeforeHours} onChange={(e) => setForm({ ...form, bufferBeforeHours: e.target.value })} /></Field><Field label="Buffer après (h)"><input type="number" min="0" step="0.5" style={input} value={form.bufferAfterHours} onChange={(e) => setForm({ ...form, bufferAfterHours: e.target.value })} /></Field></div>

                <h3 style={{ marginTop: 24 }}>Équipements</h3>
                {!formDates.valid ? <div style={{ color: '#64748b' }}>Choisissez une période valide pour voir la disponibilité.</div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>{activeAssets.map((asset) => { const id = asset._id || ''; const available = formAvailability.get(id) === true; const selected = selectedAssetIds.includes(id); return <label key={id} style={{ border: `1px solid ${selected ? '#116dff' : '#e5e7eb'}`, borderRadius: 9, padding: 12, opacity: available ? 1 : .5, background: selected ? '#eff6ff' : '#fff' }}><input type="checkbox" checked={selected} disabled={!available} onChange={() => available && toggleAsset(id)} /> <strong>{asset.title}</strong> · {asset.assetNumber}<div style={{ marginTop: 4, fontSize: 12, color: available ? '#166534' : '#991b1b' }}>{available ? 'Disponible' : 'Conflit de réservation / buffer'}</div></label>; })}</div>}

                <h3 style={{ marginTop: 24 }}>Paiement</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 }}>
                  <Field label="Paiement à la réservation"><select style={input} value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value as PaymentMode })}><option value="NONE">Aucun paiement maintenant</option><option value="FULL">Paiement complet</option><option value="DEPOSIT">Dépôt de réservation</option></select></Field>
                  {form.paymentMode === 'DEPOSIT' ? <><Field label="Type de dépôt"><select style={input} value={form.depositType} onChange={(e) => setForm({ ...form, depositType: e.target.value as DepositType })}><option value="PERCENT">Pourcentage</option><option value="FIXED">Montant fixe</option></select></Field><Field label={form.depositType === 'PERCENT' ? 'Dépôt (%)' : 'Dépôt fixe'}><input type="number" min="0" step="0.01" style={input} value={form.depositValue} onChange={(e) => setForm({ ...form, depositValue: e.target.value })} /></Field></> : null}
                </div>

                {pricingLines.length > 0 && <div style={{ ...card, background: '#f8fafc', marginTop: 18 }}><h3 style={{ marginTop: 0 }}>Résumé financier</h3>{pricingLines.map((line) => <div key={line.asset._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}><span>{line.asset.title} · {line.billableDays} jour(s) · {line.pricingMode}</span><strong>{money(line.totalCents, currency)}</strong></div>)}<hr style={{ border: 0, borderTop: '1px solid #e5e7eb' }} /><FinanceRow label="Sous-total" value={money(subtotalCents, currency)} />{discountCents > 0 ? <FinanceRow label={`Rabais client (${discountPercent} %)`} value={`-${money(discountCents, currency)}`} /> : null}<FinanceRow label="Avant taxes" value={money(taxPreview.preTaxTotalCents, currency)} />{taxPreview.tax1Cents > 0 ? <FinanceRow label={`${settings.tax1Name || 'Taxe 1'} (${settings.tax1Rate || 0} %)`} value={money(taxPreview.tax1Cents, currency)} /> : null}{taxPreview.tax2Cents > 0 ? <FinanceRow label={`${settings.tax2Name || 'Taxe 2'} (${settings.tax2Rate || 0} %)`} value={money(taxPreview.tax2Cents, currency)} /> : null}<FinanceRow strong label="Total" value={money(taxPreview.totalCents, currency)} /><FinanceRow label="À payer maintenant" value={money(depositPreview.amountDueNowCents, currency)} /><FinanceRow label="Solde après ce paiement" value={money(depositPreview.balanceDueCents, currency)} /></div>}
                <div style={{ marginTop: 18 }}><Field label="Notes"><textarea style={{ ...input, minHeight: 80 }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button type="button" style={secondary} onClick={() => setFormOpen(false)} disabled={saving}>Annuler</button><button type="submit" style={primary} disabled={saving}>{saving ? 'Création…' : 'Créer la réservation'}</button></div>
            </form>
          </div>
        </div>
      )}

      {selectedReservation && (
        <div onMouseDown={() => !processing && setSelectedReservation(null)} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(15,23,42,.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 18 }}>
          <div onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 1120, maxHeight: '94vh', overflowY: 'auto', background: '#fff', borderRadius: 14 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}><div><h2 style={{ margin: 0 }}>{selectedReservation.reservationNumber}</h2><div style={{ color: '#64748b', marginTop: 5 }}>{selectedReservation.customerName} · {stageLabels[selectedReservation.workflowStage || 'RESERVATION']}</div></div><div style={{ display: 'flex', gap: 8 }}><button style={danger} disabled={processing || selectedReservation.status === 'CANCELLED' || selectedReservation.status === 'COMPLETED'} onClick={() => void cancelReservation(selectedReservation)}>Annuler</button><button onClick={() => setSelectedReservation(null)} style={{ border: 0, background: 'transparent', fontSize: 26 }}>×</button></div></div>
            <div style={{ display: 'flex', gap: 6, padding: '12px 24px', overflowX: 'auto', borderBottom: '1px solid #e5e7eb' }}>{([['DETAILS','Détails'],['EQUIPMENT','Équipements'],['PAYMENTS','Paiements'],['DOCUMENTS','Documents'],['INSPECTION','Inspection'],['NOTES','Notes'],['HISTORY','Historique']] as [DetailTab,string][]).map(([key,label]) => <ViewButton key={key} active={detailTab === key} onClick={() => setDetailTab(key)}>{label}</ViewButton>)}</div>
            <div style={{ padding: 24 }}>
              {detailTab === 'DETAILS' && <div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}><Info label="Client" value={selectedReservation.customerName || '—'} /><Info label="Début" value={dateTime(selectedReservation.startDateTime)} /><Info label="Fin" value={dateTime(selectedReservation.endDateTime)} /><Info label="Buffer" value={`${selectedReservation.bufferBeforeHours || 0} h avant · ${selectedReservation.bufferAfterHours || 0} h après`} /><Info label="Étape" value={stageLabels[selectedReservation.workflowStage || 'RESERVATION']} /><Info label="Total" value={money(selectedReservation.totalCents, selectedReservation.currency || 'CAD')} /><Info label="À payer initialement" value={money(selectedReservation.amountDueNowCents, selectedReservation.currency || 'CAD')} /><Info label="Solde actuel" value={money(liveBalance, selectedReservation.currency || 'CAD')} /></div><div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 20 }}>{selectedReservation.status === 'CONFIRMED' ? <button style={successButton} disabled={processing} onClick={() => void checkout()}>Confirmer le départ</button> : null}{selectedReservation.status === 'RENTED' ? <button style={successButton} disabled={processing} onClick={() => void returnRental()}>Confirmer le retour</button> : null}{selectedReservation.status === 'RETURNED' ? <button style={successButton} disabled={processing} onClick={() => void closeRental()}>Clôturer</button> : null}</div></div>}

              {detailTab === 'EQUIPMENT' && <div style={{ display: 'grid', gap: 10 }}>{linkedItems.map((item) => <div key={item._id} style={{ ...card, padding: 14 }}><strong>{item.assetTitle || item.assetNumber}</strong><div style={{ color: '#64748b', marginTop: 4 }}>{item.assetNumber} · {item.billableDays || 0} jour(s) · {item.pricingMode}</div><div style={{ marginTop: 4 }}>{dateTime(item.blockedStartDateTime)} → {dateTime(item.blockedEndDateTime)} (période bloquée)</div><div style={{ marginTop: 4, fontWeight: 700 }}>{money(item.lineTotalCents, item.currency || selectedReservation.currency || 'CAD')}</div></div>)}</div>}

              {detailTab === 'PAYMENTS' && <div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10, marginBottom: 18 }}><Info label="Total" value={money(selectedReservation.totalCents, selectedReservation.currency || 'CAD')} /><Info label="Payé" value={money(paidCents, selectedReservation.currency || 'CAD')} /><Info label="Solde" value={money(liveBalance, selectedReservation.currency || 'CAD')} /></div>{liveBalance > 0 ? <button style={primary} disabled={processing} onClick={() => void createWixPaymentLink()}>Créer lien de paiement Wix — {money(paidCents === 0 && initialDue > 0 ? initialDue : liveBalance, selectedReservation.currency || 'CAD')}</button> : <div style={{ ...card, background: '#f0fdf4', color: '#166534' }}>Réservation payée en totalité.</div>}<div style={{ display: 'grid', gap: 10, marginTop: 18 }}>{linkedPayments.length === 0 ? <div style={{ color: '#64748b' }}>Aucun paiement.</div> : linkedPayments.map((payment) => <div key={payment._id} style={{ ...card, padding: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><strong>{payment.paymentNumber}</strong><div style={{ color: '#64748b', marginTop: 3 }}>{payment.method} · {payment.status} · {payment.paymentType}</div></div><strong>{money(payment.amountCents, payment.currency || 'CAD')}</strong></div>{payment.wixPaymentUrl ? <button style={{ ...secondary, marginTop: 8 }} onClick={() => window.open(payment.wixPaymentUrl, '_blank', 'noopener,noreferrer')}>Ouvrir le checkout Wix</button> : null}{payment.wixPaymentLinkId && payment.status !== 'PAID' ? <button style={{ ...secondary, marginTop: 8, marginLeft: 8 }} disabled={processing} onClick={() => void refreshWixPayment(payment)}>Actualiser le statut Wix</button> : null}</div>)}</div></div>}

              {detailTab === 'DOCUMENTS' && <div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}><button style={secondary} disabled={processing} onClick={() => void createDocument('QUOTE')}>+ Devis</button><button style={secondary} disabled={processing} onClick={() => void createDocument('CONTRACT')}>+ Contrat</button><button style={secondary} disabled={processing} onClick={() => void createDocument('INVOICE')}>+ Facture</button></div><div style={{ display: 'grid', gap: 10 }}>{linkedDocuments.length === 0 ? <div style={{ color: '#64748b' }}>Aucun document généré.</div> : linkedDocuments.map((document) => <div key={document._id} style={{ ...card, padding: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><strong>{documentLabels[document.documentType || 'QUOTE']} · {document.documentNumber}</strong><div style={{ color: '#64748b', marginTop: 3 }}>Modèle : {document.templateName || '—'} · {document.status}</div></div><strong>{money(document.amountCents, document.currency || 'CAD')}</strong></div><div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}><button style={secondary} onClick={() => printDocument(document)}>Aperçu / PDF</button>{document.documentType === 'QUOTE' && document.status !== 'ACCEPTED' ? <button style={successButton} onClick={() => void updateDocumentStatus(document, 'ACCEPT')}>Accepter le devis</button> : null}{document.documentType === 'CONTRACT' && document.status !== 'SIGNED' ? <button style={successButton} onClick={() => void updateDocumentStatus(document, 'SIGN')}>Signer le contrat</button> : null}{document.documentType === 'INVOICE' && document.status !== 'ISSUED' ? <button style={successButton} onClick={() => void updateDocumentStatus(document, 'ISSUE')}>Émettre la facture</button> : null}</div></div>)}</div></div>}

              {detailTab === 'INSPECTION' && <div><button style={primary} onClick={() => { setInspectionForm({ ...blankInspection, inspectionType: selectedReservation.status === 'RENTED' ? 'RETURN' : 'DEPARTURE', assetId: linkedItems[0]?.assetId || '' }); setInspectionOpen(true); }}>+ Inspection</button><div style={{ display: 'grid', gap: 10, marginTop: 16 }}>{linkedInspections.length === 0 ? <div style={{ color: '#64748b' }}>Aucune inspection.</div> : linkedInspections.map((inspection) => <div key={inspection._id} style={{ ...card, padding: 14 }}><strong>{inspection.inspectionType === 'DEPARTURE' ? 'Départ' : 'Retour'} · {inspection.assetTitle}</strong><div style={{ color: '#64748b', marginTop: 3 }}>{dateTime(inspection.inspectionDate)} · État : {inspection.condition}</div>{inspection.hasDamage ? <div style={{ marginTop: 6, color: '#991b1b' }}>Dommage : {inspection.damageDescription} · {money(inspection.damageAmountCents, selectedReservation.currency || 'CAD')}</div> : null}{inspection.signerName ? <div style={{ marginTop: 5 }}>Signataire : {inspection.signerName}</div> : null}</div>)}</div></div>}

              {detailTab === 'NOTES' && <div><textarea style={{ ...input, minHeight: 180 }} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} /><button style={{ ...primary, marginTop: 10 }} disabled={processing} onClick={() => void saveNotes()}>Enregistrer les notes</button></div>}

              {detailTab === 'HISTORY' && <div style={{ display: 'grid', gap: 9 }}>{linkedActivity.length === 0 ? <div style={{ color: '#64748b' }}>Aucun événement enregistré.</div> : linkedActivity.map((entry) => <div key={entry._id} style={{ borderLeft: '3px solid #116dff', padding: '7px 12px' }}><strong>{entry.description || entry.actionType}</strong><div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>{dateTime(entry.eventDate || entry._createdDate)} · {entry.actor || 'RentalFlow'}</div></div>)}</div>}
            </div>
          </div>
        </div>
      )}

      {inspectionOpen && selectedReservation && (
        <div onMouseDown={() => !processing && setInspectionOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15,23,42,.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 18 }}><div onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 720, background: '#fff', borderRadius: 14 }}><form onSubmit={saveInspection}><div style={{ padding: 20, borderBottom: '1px solid #e5e7eb' }}><h2 style={{ margin: 0 }}>Inspection</h2></div><div style={{ padding: 20, display: 'grid', gap: 12 }}><Field label="Type"><select style={input} value={inspectionForm.inspectionType} onChange={(e) => setInspectionForm({ ...inspectionForm, inspectionType: e.target.value as InspectionType })}><option value="DEPARTURE">Départ</option><option value="RETURN">Retour</option></select></Field><Field label="Équipement"><select style={input} value={inspectionForm.assetId} onChange={(e) => setInspectionForm({ ...inspectionForm, assetId: e.target.value })}><option value="">Sélectionner…</option>{linkedItems.map((item) => <option key={item.assetId} value={item.assetId}>{item.assetTitle} · {item.assetNumber}</option>)}</select></Field><Field label="État"><select style={input} value={inspectionForm.condition} onChange={(e) => setInspectionForm({ ...inspectionForm, condition: e.target.value })}><option value="GOOD">Bon</option><option value="FAIR">Acceptable</option><option value="DAMAGED">Endommagé</option></select></Field><label><input type="checkbox" checked={inspectionForm.hasDamage} onChange={(e) => setInspectionForm({ ...inspectionForm, hasDamage: e.target.checked })} /> Dommage constaté</label>{inspectionForm.hasDamage ? <><Field label="Description"><textarea style={{ ...input, minHeight: 70 }} value={inspectionForm.damageDescription} onChange={(e) => setInspectionForm({ ...inspectionForm, damageDescription: e.target.value })} /></Field><Field label="Montant dommage"><input type="number" min="0" step="0.01" style={input} value={inspectionForm.damageAmount} onChange={(e) => setInspectionForm({ ...inspectionForm, damageAmount: e.target.value })} /></Field></> : null}<Field label="Photos (URL, séparées par virgules)"><input style={input} value={inspectionForm.photoUrls} onChange={(e) => setInspectionForm({ ...inspectionForm, photoUrls: e.target.value })} /></Field><Field label="Signataire"><input style={input} value={inspectionForm.signerName} onChange={(e) => setInspectionForm({ ...inspectionForm, signerName: e.target.value })} /></Field><Field label="Notes"><textarea style={{ ...input, minHeight: 70 }} value={inspectionForm.notes} onChange={(e) => setInspectionForm({ ...inspectionForm, notes: e.target.value })} /></Field></div><div style={{ padding: 16, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" style={secondary} onClick={() => setInspectionOpen(false)}>Annuler</button><button type="submit" style={primary} disabled={processing}>Enregistrer</button></div></form></div></div>
      )}
    </WixDesignSystemProvider>
  );
};

const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => <label style={{ display: 'block' }}><span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</span>{children}</label>;
const ViewButton: FC<{ active: boolean; onClick: () => void; children: string }> = ({ active, onClick, children }) => <button onClick={onClick} style={{ ...secondary, background: active ? '#116dff' : '#fff', color: active ? '#fff' : '#116dff', whiteSpace: 'nowrap' }}>{children}</button>;
const FinanceRow: FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: strong ? 700 : 400, fontSize: strong ? 17 : 14 }}><span>{label}</span><span>{value}</span></div>;
const Info: FC<{ label: string; value: string }> = ({ label, value }) => <div style={{ background: '#f8fafc', borderRadius: 9, padding: 13 }}><div style={{ color: '#64748b', fontSize: 12 }}>{label}</div><div style={{ fontWeight: 700, marginTop: 4 }}>{value}</div></div>;
const TemplatePicker: FC<{ label: string; type: DocumentType; value: string; templates: DocumentTemplate[]; onChange: (value: string) => void }> = ({ label, type, value, templates, onChange }) => <Field label={label}><select style={input} value={value} onChange={(e) => onChange(e.target.value)}><option value="">Aucun modèle</option>{templates.filter((template) => template.documentType === type).map((template) => <option key={template._id} value={template._id}>{template.name}</option>)}</select></Field>;
const ReservationList: FC<{ reservations: Reservation[]; onOpen: (reservation: Reservation) => void }> = ({ reservations, onOpen }) => <div style={card}>{reservations.length === 0 ? <div style={{ color: '#64748b' }}>Aucune réservation.</div> : <div style={{ display: 'grid', gap: 10 }}>{reservations.map((reservation) => <div key={reservation._id} style={{ border: '1px solid #e5e7eb', borderRadius: 9, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', opacity: reservation.status === 'CANCELLED' ? .55 : 1 }}><div><strong>{reservation.reservationNumber} · {reservation.customerName}</strong><div style={{ color: '#64748b', marginTop: 3 }}>{dateTime(reservation.startDateTime)} → {dateTime(reservation.endDateTime)} · {stageLabels[reservation.workflowStage || 'RESERVATION']}</div></div><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><strong>{money(reservation.totalCents, reservation.currency || 'CAD')}</strong><button style={secondary} onClick={() => onOpen(reservation)}>Ouvrir</button></div></div>)}</div>}</div>;

export default ReservationsV2Page;
