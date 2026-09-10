import type { APIRoute } from 'astro';
import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import { calculateRentalPrice, getBlockedRange, rangesOverlap } from '../../lib/rental-pricing';
import {
  calculateDeposit,
  calculateTaxes,
  parseRequiredFields,
  validateRequiredFields,
  type DepositType,
  type PaymentMode,
} from '../../lib/reservation-finance';

const ASSETS = '@pilotedavid1/rental-flow/assets';
const CUSTOMERS = '@pilotedavid1/rental-flow/customers';
const RESERVATIONS = '@pilotedavid1/rental-flow/reservations';
const RESERVATION_ITEMS = '@pilotedavid1/rental-flow/reservation-items';
const DOCUMENT_TEMPLATES = '@pilotedavid1/rental-flow/document-templates';
const SETTINGS = '@pilotedavid1/rental-flow/app-settings';
const PAYMENTS = '@pilotedavid1/rental-flow/payments';
const ACTIVITY = '@pilotedavid1/rental-flow/activity-log';

type Asset = {
  _id?: string;
  title?: string;
  assetNumber?: string;
  productType?: string;
  status?: string;
  dailyRateCents?: number;
  weeklyRateCents?: number;
  monthlyRateCents?: number;
  discountAfterDays?: number;
  discountPercent?: number;
  currency?: string;
  active?: boolean;
};

type ReservationItem = {
  _id?: string;
  assetId?: string;
  status?: string;
  blockedStartDateTime?: Date | string;
  blockedEndDateTime?: Date | string;
};

type AppSettings = {
  _id?: string;
  settingsKey?: string;
  companyName?: string;
  logoUrl?: string;
  currency?: string;
  defaultBufferBeforeHours?: number;
  defaultBufferAfterHours?: number;
  taxesEnabled?: boolean;
  tax1Name?: string;
  tax1Rate?: number;
  tax2Name?: string;
  tax2Rate?: number;
  tax2Compound?: boolean;
  defaultDepositEnabled?: boolean;
  defaultDepositType?: DepositType;
  defaultDepositValue?: number;
  defaultQuoteTemplateId?: string;
  defaultContractTemplateId?: string;
  defaultInvoiceTemplateId?: string;
};

type DocumentTemplate = {
  _id?: string;
  name?: string;
  documentType?: 'QUOTE' | 'CONTRACT' | 'INVOICE';
  requiredFieldsCsv?: string;
  active?: boolean;
};

type PublicCustomer = {
  name?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
};

type BookingRequest = {
  startDateTime?: string;
  endDateTime?: string;
  assetIds?: string[];
  paymentMode?: 'FULL' | 'DEPOSIT';
  customer?: PublicCustomer;
  notes?: string;
};

const defaultSettings: AppSettings = {
  settingsKey: 'default',
  currency: 'CAD',
  defaultBufferBeforeHours: 0,
  defaultBufferAfterHours: 0,
  taxesEnabled: true,
  tax1Name: 'TPS',
  tax1Rate: 5,
  tax2Name: 'TVQ',
  tax2Rate: 9.975,
  tax2Compound: false,
  defaultDepositEnabled: false,
  defaultDepositType: 'PERCENT',
  defaultDepositValue: 25,
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function asDate(value?: Date | string): Date {
  if (value instanceof Date) return value;
  return value ? new Date(value) : new Date(0);
}

function clean(value: unknown, max = 200): string {
  return String(value ?? '').trim().slice(0, max);
}

function generatedNumber(prefix: string): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `${prefix}-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
}

async function elevatedFind(query: any): Promise<any> {
  const run = auth.elevate(query.find.bind(query));
  return run();
}

async function elevatedInsert(collectionId: string, item: Record<string, unknown>): Promise<any> {
  const insert = auth.elevate(items.insert);
  return insert(collectionId, item);
}

async function elevatedUpdate(collectionId: string, item: Record<string, unknown>): Promise<any> {
  const update = auth.elevate(items.update);
  return update(collectionId, item);
}

async function requireAppInstance(): Promise<void> {
  const tokenInfo = await auth.getTokenInfo();
  if (!tokenInfo?.instanceId) throw new Error('UNAUTHORIZED');
}

async function loadSettingsAndTemplates(): Promise<{ settings: AppSettings; templates: DocumentTemplate[] }> {
  const [settingsResult, templatesResult] = await Promise.all([
    elevatedFind(items.query(SETTINGS).eq('settingsKey', 'default').limit(1)),
    elevatedFind(items.query(DOCUMENT_TEMPLATES).limit(100)),
  ]);
  const saved = settingsResult.items?.[0] as AppSettings | undefined;
  return {
    settings: { ...defaultSettings, ...(saved || {}) },
    templates: (templatesResult.items || []) as DocumentTemplate[],
  };
}

function requiredFieldsForDefaults(settings: AppSettings, templates: DocumentTemplate[]): string[] {
  const ids = [
    settings.defaultQuoteTemplateId,
    settings.defaultContractTemplateId,
    settings.defaultInvoiceTemplateId,
  ].filter(Boolean);

  const fields = ids.flatMap((id) => {
    const template = templates.find((candidate) => candidate._id === id && candidate.active !== false);
    return parseRequiredFields(template?.requiredFieldsCsv);
  });

  return [...new Set(fields)];
}

async function loadActiveAssets(): Promise<Asset[]> {
  const result = await elevatedFind(items.query(ASSETS).limit(1000));
  return (result.items as Asset[]).filter((asset) => asset.active !== false && asset.status !== 'INACTIVE');
}

async function loadBlockingItems(): Promise<ReservationItem[]> {
  const result = await elevatedFind(items.query(RESERVATION_ITEMS).limit(1000));
  return result.items as ReservationItem[];
}

function isAssetAvailable(
  assetId: string,
  start: Date,
  end: Date,
  before: number,
  after: number,
  blockingItems: ReservationItem[]
): boolean {
  const requested = getBlockedRange(start, end, before, after);
  return !blockingItems.some((item) => {
    if (item.assetId !== assetId || item.status === 'CANCELLED' || item.status === 'COMPLETED') return false;
    const existingStart = asDate(item.blockedStartDateTime);
    const existingEnd = asDate(item.blockedEndDateTime);
    if (!existingStart.getTime() || !existingEnd.getTime()) return false;
    return rangesOverlap(requested.blockedStart, requested.blockedEnd, existingStart, existingEnd);
  });
}

function validatePeriod(startValue?: string, endValue?: string): { start: Date; end: Date } {
  const start = startValue ? new Date(startValue) : new Date(0);
  const end = endValue ? new Date(endValue) : new Date(0);
  if (!start.getTime() || !end.getTime() || end <= start) throw new Error('INVALID_PERIOD');
  const maxDuration = 366 * 24 * 60 * 60 * 1000;
  if (end.getTime() - start.getTime() > maxDuration) throw new Error('PERIOD_TOO_LONG');
  if (end.getTime() < Date.now()) throw new Error('PAST_PERIOD');
  return { start, end };
}

function publicAsset(asset: Asset, start?: Date, end?: Date, settings?: AppSettings, blockingItems: ReservationItem[] = []) {
  const before = settings?.defaultBufferBeforeHours || 0;
  const after = settings?.defaultBufferAfterHours || 0;
  let available: boolean | null = null;
  let billableDays = 0;
  let lineTotalCents = 0;
  let pricingMode = '';

  if (asset._id && start && end && settings) {
    available = isAssetAvailable(asset._id, start, end, before, after, blockingItems);
    try {
      const price = calculateRentalPrice(asset, start, end, {
        allowWeekly: true,
        allowMonthly: true,
        allowLongTermDiscount: true,
      });
      billableDays = price.billableDays;
      lineTotalCents = price.totalCents;
      pricingMode = price.pricingMode;
    } catch {
      available = false;
    }
  }

  return {
    id: asset._id || '',
    title: asset.title || 'Équipement',
    productType: asset.productType || '',
    currency: asset.currency || settings?.currency || 'CAD',
    dailyRateCents: asset.dailyRateCents || 0,
    weeklyRateCents: asset.weeklyRateCents || 0,
    monthlyRateCents: asset.monthlyRateCents || 0,
    available,
    billableDays,
    lineTotalCents,
    pricingMode,
  };
}

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAppInstance();
    const url = new URL(request.url);
    const startValue = url.searchParams.get('start') || undefined;
    const endValue = url.searchParams.get('end') || undefined;
    const { settings, templates } = await loadSettingsAndTemplates();
    const assets = await loadActiveAssets();

    let start: Date | undefined;
    let end: Date | undefined;
    let blockingItems: ReservationItem[] = [];
    if (startValue && endValue) {
      const period = validatePeriod(startValue, endValue);
      start = period.start;
      end = period.end;
      blockingItems = await loadBlockingItems();
    }

    return json({
      company: {
        name: settings.companyName || 'Location en ligne',
        logoUrl: settings.logoUrl || '',
      },
      settings: {
        currency: settings.currency || 'CAD',
        taxesEnabled: settings.taxesEnabled !== false,
        tax1Name: settings.tax1Name || '',
        tax1Rate: settings.tax1Rate || 0,
        tax2Name: settings.tax2Name || '',
        tax2Rate: settings.tax2Rate || 0,
        tax2Compound: settings.tax2Compound === true,
        depositEnabled: settings.defaultDepositEnabled === true,
        depositType: settings.defaultDepositType || 'PERCENT',
        depositValue: settings.defaultDepositValue || 0,
        requiredFields: requiredFieldsForDefaults(settings, templates),
      },
      assets: assets.map((asset) => publicAsset(asset, start, end, settings, blockingItems)),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return json({ error: 'Unauthorized' }, 401);
    if (error instanceof Error && ['INVALID_PERIOD', 'PERIOD_TOO_LONG', 'PAST_PERIOD'].includes(error.message)) {
      return json({ error: error.message }, 400);
    }
    console.error('RentalFlow public booking GET failed', error);
    return json({ error: 'Impossible de charger la réservation en ligne.' }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  let createdReservation: any = null;
  const createdItems: any[] = [];

  try {
    await requireAppInstance();
    const body = await request.json() as BookingRequest;
    const { start, end } = validatePeriod(body.startDateTime, body.endDateTime);
    const assetIds = [...new Set((body.assetIds || []).map((id) => clean(id, 80)).filter(Boolean))];
    if (!assetIds.length || assetIds.length > 25) return json({ error: 'Sélection d’équipement invalide.' }, 400);

    const customer = {
      name: clean(body.customer?.name, 150),
      email: clean(body.customer?.email, 200).toLowerCase(),
      phone: clean(body.customer?.phone, 60),
      addressLine1: clean(body.customer?.addressLine1, 200),
      addressLine2: clean(body.customer?.addressLine2, 200),
      city: clean(body.customer?.city, 120),
      region: clean(body.customer?.region, 120),
      postalCode: clean(body.customer?.postalCode, 30).toUpperCase(),
      country: clean(body.customer?.country, 120) || 'Canada',
    };
    if (!customer.name) return json({ error: 'Le nom du client est obligatoire.' }, 400);
    if (!customer.email || !customer.email.includes('@')) return json({ error: 'Un courriel valide est obligatoire.' }, 400);

    const [{ settings, templates }, activeAssets, blockingItems] = await Promise.all([
      loadSettingsAndTemplates(),
      loadActiveAssets(),
      loadBlockingItems(),
    ]);

    const requiredFields = requiredFieldsForDefaults(settings, templates);
    const missing = validateRequiredFields(requiredFields, {
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      customerAddressLine1: customer.addressLine1,
      customerCity: customer.city,
      customerRegion: customer.region,
      customerPostalCode: customer.postalCode,
      customerCountry: customer.country,
      startDateTime: body.startDateTime,
      endDateTime: body.endDateTime,
      selectedAssetCount: assetIds.length,
    });
    if (missing.length) return json({ error: `Informations requises : ${missing.join(', ')}.` }, 400);

    const selectedAssets = assetIds.map((id) => activeAssets.find((asset) => asset._id === id)).filter((asset): asset is Asset => !!asset);
    if (selectedAssets.length !== assetIds.length) return json({ error: 'Un équipement sélectionné n’est plus disponible.' }, 409);

    const before = settings.defaultBufferBeforeHours || 0;
    const after = settings.defaultBufferAfterHours || 0;
    for (const asset of selectedAssets) {
      if (!asset._id || !isAssetAvailable(asset._id, start, end, before, after, blockingItems)) {
        return json({ error: `${asset.title || 'Un équipement'} n’est plus disponible pour cette période.` }, 409);
      }
    }

    const priceLines = selectedAssets.map((asset) => ({
      asset,
      ...calculateRentalPrice(asset, start, end, {
        allowWeekly: true,
        allowMonthly: true,
        allowLongTermDiscount: true,
      }),
    }));
    const subtotalCents = priceLines.reduce((sum, line) => sum + line.totalCents, 0);
    const taxResult = calculateTaxes(subtotalCents, settings);
    const paymentMode: PaymentMode = body.paymentMode === 'DEPOSIT' && settings.defaultDepositEnabled ? 'DEPOSIT' : 'FULL';
    const depositType = settings.defaultDepositType || 'PERCENT';
    const depositValue = settings.defaultDepositValue || 0;
    const depositResult = calculateDeposit(taxResult.totalCents, paymentMode, depositType, depositValue);
    const currency = priceLines[0]?.asset.currency || settings.currency || 'CAD';

    const existingCustomerResult = await elevatedFind(items.query(CUSTOMERS).eq('email', customer.email).limit(1));
    const existingCustomer = existingCustomerResult.items?.[0] as any | undefined;
    let customerId = existingCustomer?._id || '';
    let customerNumber = existingCustomer?.customerNumber || '';

    if (!customerId) {
      const createdCustomer = await elevatedInsert(CUSTOMERS, {
        customerNumber: generatedNumber('C'),
        firstName: customer.name,
        lastName: '',
        companyName: '',
        email: customer.email,
        phone: customer.phone,
        addressLine1: customer.addressLine1,
        addressLine2: customer.addressLine2,
        city: customer.city,
        region: customer.region,
        postalCode: customer.postalCode,
        country: customer.country,
        discountPercent: 0,
        active: true,
      });
      customerId = createdCustomer._id || '';
      customerNumber = createdCustomer.customerNumber || '';
    }

    const quoteTemplate = templates.find((template) => template._id === settings.defaultQuoteTemplateId && template.active !== false);
    const contractTemplate = templates.find((template) => template._id === settings.defaultContractTemplateId && template.active !== false);
    const invoiceTemplate = templates.find((template) => template._id === settings.defaultInvoiceTemplateId && template.active !== false);
    const reservationNumber = generatedNumber('RF');

    createdReservation = await elevatedInsert(RESERVATIONS, {
      reservationNumber,
      customerId,
      customerNumber,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      customerAddressLine1: customer.addressLine1,
      customerAddressLine2: customer.addressLine2,
      customerCity: customer.city,
      customerRegion: customer.region,
      customerPostalCode: customer.postalCode,
      customerCountry: customer.country,
      startDateTime: start,
      endDateTime: end,
      bufferBeforeHours: before,
      bufferAfterHours: after,
      status: 'CONFIRMED',
      workflowStage: 'PAYMENT',
      quoteTemplateId: quoteTemplate?._id || '',
      quoteTemplateName: quoteTemplate?.name || '',
      contractTemplateId: contractTemplate?._id || '',
      contractTemplateName: contractTemplate?.name || '',
      invoiceTemplateId: invoiceTemplate?._id || '',
      invoiceTemplateName: invoiceTemplate?.name || '',
      subtotalCents,
      customerDiscountPercent: 0,
      discountCents: 0,
      preTaxTotalCents: taxResult.preTaxTotalCents,
      tax1Name: settings.taxesEnabled === false ? '' : settings.tax1Name || '',
      tax1Rate: settings.taxesEnabled === false ? 0 : settings.tax1Rate || 0,
      tax1Cents: taxResult.tax1Cents,
      tax2Name: settings.taxesEnabled === false ? '' : settings.tax2Name || '',
      tax2Rate: settings.taxesEnabled === false ? 0 : settings.tax2Rate || 0,
      tax2Cents: taxResult.tax2Cents,
      taxTotalCents: taxResult.taxTotalCents,
      totalCents: taxResult.totalCents,
      currency,
      depositRequired: paymentMode === 'DEPOSIT',
      depositType,
      depositValue,
      depositAmountCents: depositResult.depositAmountCents,
      amountDueNowCents: depositResult.amountDueNowCents,
      balanceDueCents: depositResult.balanceDueCents,
      paymentMode,
      notes: clean(body.notes, 1000),
    });

    const blocked = getBlockedRange(start, end, before, after);
    for (const line of priceLines) {
      if (!line.asset._id) continue;
      const createdItem = await elevatedInsert(RESERVATION_ITEMS, {
        reservationId: createdReservation._id,
        reservationNumber,
        assetId: line.asset._id,
        assetNumber: line.asset.assetNumber || '',
        assetTitle: line.asset.title || '',
        startDateTime: start,
        endDateTime: end,
        blockedStartDateTime: blocked.blockedStart,
        blockedEndDateTime: blocked.blockedEnd,
        bufferBeforeHours: before,
        bufferAfterHours: after,
        billableDays: line.billableDays,
        lineTotalCents: line.totalCents,
        pricingMode: line.pricingMode,
        currency: line.asset.currency || currency,
        status: 'CONFIRMED',
      });
      createdItems.push(createdItem);
    }

    await elevatedInsert(ACTIVITY, {
      reservationId: createdReservation._id,
      reservationNumber,
      actionType: 'ONLINE_RESERVATION_CREATED',
      description: `Réservation en ligne ${reservationNumber} créée par ${customer.name}.`,
      actor: 'Client en ligne',
      eventDate: new Date(),
    });

    const amount = depositResult.amountDueNowCents;
    if (amount <= 0) {
      return json({
        reservationNumber,
        totalCents: taxResult.totalCents,
        amountDueNowCents: 0,
        balanceDueCents: depositResult.balanceDueCents,
        currency,
        checkoutUrl: '',
      }, 201);
    }

    const wixGetPaid = await import('@wix/get-paid') as any;
    const api = wixGetPaid.paymentLinks;
    if (!api?.createPaymentLink) throw new Error('PAYLINK_UNAVAILABLE');
    const createPaymentLink = auth.elevate(api.createPaymentLink);
    const label = paymentMode === 'DEPOSIT' ? 'Dépôt de réservation' : 'Paiement de location';
    const paymentLinkResponse = await createPaymentLink({
      title: `${reservationNumber} — ${label}`,
      description: `Paiement RentalFlow pour ${customer.name}`,
      currency,
      type: 'ECOM',
      paymentsLimit: 1,
      displayData: {},
      ecomPaymentLink: {
        lineItems: [{
          type: 'CUSTOM',
          customItem: {
            name: `${label} ${reservationNumber}`,
            quantity: 1,
            price: (amount / 100).toFixed(2),
          },
        }],
      },
    });

    const link = paymentLinkResponse?.paymentLink || paymentLinkResponse;
    const linkId = link?._id || link?.id;
    if (!linkId) throw new Error('PAYLINK_NO_ID');

    let checkoutUrl = link?.links?.find?.((entry: any) => entry?.url?.url)?.url?.url
      || link?.links?.find?.((entry: any) => typeof entry?.url === 'string')?.url
      || link?.url?.url
      || link?.url
      || '';
    let checkoutId = '';

    if (!checkoutUrl && api.initiatePayment) {
      const initiatePayment = auth.elevate(api.initiatePayment);
      const initiated = await initiatePayment(linkId);
      checkoutUrl = initiated?.ecomCheckout?.checkoutUrl || initiated?.checkoutUrl || '';
      checkoutId = initiated?.ecomCheckout?.checkoutId || initiated?.checkoutId || '';
    }

    await elevatedInsert(PAYMENTS, {
      reservationId: createdReservation._id,
      reservationNumber,
      paymentNumber: generatedNumber('PAY'),
      paymentType: paymentMode === 'DEPOSIT' ? 'BOOKING_DEPOSIT' : 'PAYMENT',
      method: 'WIX',
      status: 'PENDING',
      amountCents: amount,
      currency,
      paymentDate: new Date(),
      reference: label,
      wixPaymentLinkId: linkId,
      wixPaymentUrl: checkoutUrl,
      wixCheckoutId: checkoutId,
      wixOnlinePayment: true,
      remainingBalanceCents: Math.max(0, taxResult.totalCents - amount),
      notes: 'Lien de paiement Wix créé depuis la réservation en ligne RentalFlow.',
    });

    await elevatedInsert(ACTIVITY, {
      reservationId: createdReservation._id,
      reservationNumber,
      actionType: 'ONLINE_PAYMENT_LINK_CREATED',
      description: `${label} créé pour ${(amount / 100).toFixed(2)} ${currency}.`,
      actor: 'RentalFlow Online Booking',
      eventDate: new Date(),
    });

    return json({
      reservationNumber,
      totalCents: taxResult.totalCents,
      amountDueNowCents: amount,
      balanceDueCents: Math.max(0, taxResult.totalCents - amount),
      currency,
      checkoutUrl,
    }, 201);
  } catch (error) {
    console.error('RentalFlow public booking POST failed', error);

    if (createdReservation?._id) {
      try {
        await elevatedUpdate(RESERVATIONS, { ...createdReservation, status: 'CANCELLED' });
        for (const item of createdItems) {
          if (item?._id) await elevatedUpdate(RESERVATION_ITEMS, { ...item, status: 'CANCELLED' });
        }
      } catch (rollbackError) {
        console.error('RentalFlow public booking rollback failed', rollbackError);
      }
    }

    if (error instanceof Error && error.message === 'UNAUTHORIZED') return json({ error: 'Unauthorized' }, 401);
    if (error instanceof Error && ['INVALID_PERIOD', 'PERIOD_TOO_LONG', 'PAST_PERIOD'].includes(error.message)) {
      return json({ error: error.message }, 400);
    }
    if (error instanceof Error && error.message.startsWith('PAYLINK')) {
      return json({ error: 'La réservation n’a pas été confirmée parce que le paiement Wix n’a pas pu être préparé.' }, 502);
    }
    return json({ error: 'Impossible de compléter la réservation en ligne.' }, 500);
  }
};
