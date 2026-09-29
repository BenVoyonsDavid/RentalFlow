import { normalizeBookingTheme, bookingImageUrl } from '../../lib/booking-theme';
import type { APIRoute } from 'astro';
import { appInstances } from '@wix/app-management';
import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import { COLLECTIONS } from '../../lib/collection-ids';
import { isAssetAvailable } from '../../lib/asset-availability';
import { normalizePublicCustomer, validatePublicCustomer, type PublicCustomerInput } from '../../lib/booking-customer';
import { acquireCatalogStockLocks, loadCatalogBlockingItems, releaseCatalogStockLocks } from '../../server/catalog-stock';
import { acquireBookingLocks, loadBlockingItems, releaseBookingLocks } from '../../server/booking-availability';
import { findOrCreatePublicCustomer } from '../../server/customer-service';
import { createOnlineReservation, rollbackReservationCreation, type CreatedOnlineReservation } from '../../server/reservation-service';
import type {
  AppSettings,
  Asset,
  BookingLock,
  CatalogStockLock,
  DocumentTemplate,
  ReservationItem,
} from '../../domain/types';
import { calculateRentalPrice } from '../../lib/rental-pricing';
import {
  calculateDeposit,
  parseRequiredFields,
  validateRequiredFields,
  type DepositType,
  type PaymentMode,
} from '../../lib/reservation-finance';
import { hasAppAccess, hasFeature, planFromAppInstanceResponse, type RentalFlowPlan } from '../../lib/plans';
import {
  computeReservationFinancials,
  type ReservationCatalogLine,
} from '../../lib/reservation-catalog';
import {
  catalogItemsForReservation,
  parseCatalogSelections,
  publicCatalogItem,
  resolveCatalogLines,
  stockTrackedCatalogItemIds,
  type BookingCatalogItem,
  type PublicCatalogSelection,
} from '../../lib/booking-catalog';

const ASSETS = COLLECTIONS.assets;
const CATALOG = COLLECTIONS.catalogItems;
const DOCUMENT_TEMPLATES = COLLECTIONS.documentTemplates;
const SETTINGS = COLLECTIONS.appSettings;
const PAYMENTS = COLLECTIONS.payments;

const MAX_PUBLIC_ASSETS = 25;

type BookingRequest = {
  startDateTime?: string;
  endDateTime?: string;
  assetIds?: string[];
  catalogItems?: PublicCatalogSelection[];
  paymentMode?: 'FULL' | 'DEPOSIT';
  customer?: PublicCustomerInput;
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

function corsHeaders(request?: Request): Record<string, string> {
  const origin = String(request?.headers.get('origin') || '').trim();
  return {
    'access-control-allow-origin': origin || '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'Authorization,Content-Type',
    'access-control-allow-credentials': origin ? 'true' : 'false',
    'access-control-max-age': '600',
    'vary': 'Origin',
  };
}

function json(data: unknown, status = 200, request?: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...corsHeaders(request),
    },
  });
}

export const OPTIONS: APIRoute = async ({ request }) => {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
};

function clean(value: unknown, max = 200): string {
  return String(value ?? '').trim().slice(0, max);
}

function elevatedQuery(collectionId: string): any {
  const query = auth.elevate(items.query);
  return query(collectionId);
}

async function elevatedFind(query: any): Promise<any> {
  return query.find();
}

async function elevatedInsert(collectionId: string, item: Record<string, unknown>): Promise<any> {
  const insert = auth.elevate(items.insert);
  return insert(collectionId, item);
}

async function elevatedUpdate(collectionId: string, item: Record<string, unknown>): Promise<any> {
  const update = auth.elevate(items.update);
  const itemId = item._id;
  if (typeof itemId !== 'string' || !itemId) throw new Error('MISSING_ITEM_ID');
  return update(collectionId, { ...item, _id: itemId });
}

async function elevatedRemove(collectionId: string, itemId: string): Promise<any> {
  const remove = auth.elevate(items.remove);
  return remove(collectionId, itemId);
}

async function requireAppInstance(): Promise<void> {
  const tokenInfo = await auth.getTokenInfo();
  if (!tokenInfo?.instanceId) throw new Error('UNAUTHORIZED');
}

function isWixDevelopmentRequest(request: Request): boolean {
  const origin = String(request.headers.get('origin') || '').toLowerCase();
  const referer = String(request.headers.get('referer') || '').toLowerCase();
  return origin.includes('wix-development-sites.org') || referer.includes('wix-development-sites.org');
}

async function loadCurrentPlan(request: Request): Promise<RentalFlowPlan> {
  try {
    const getInstance = auth.elevate(appInstances.getAppInstance);
    const response = await getInstance();
    const resolved = planFromAppInstanceResponse(response);
    if (resolved === 'NO_PLAN' && isWixDevelopmentRequest(request)) return 'TRIAL';
    return resolved;
  } catch (error) {
    console.error('RentalFlow public booking could not resolve Wix plan.', error);
    return isWixDevelopmentRequest(request) ? 'TRIAL' : 'NO_PLAN';
  }
}

async function loadSettingsAndTemplates(): Promise<{ settings: AppSettings; templates: DocumentTemplate[] }> {
  const [settingsResult, templatesResult] = await Promise.all([
    elevatedFind(elevatedQuery(SETTINGS).eq('settingsKey', 'default').limit(1)),
    elevatedFind(elevatedQuery(DOCUMENT_TEMPLATES).limit(100)),
  ]);
  const saved = settingsResult.items?.[0] as AppSettings | undefined;
  return {
    settings: { ...defaultSettings, ...(saved || {}) },
    templates: (templatesResult.items || []) as DocumentTemplate[],
  };
}

function requiredFieldsForDefaults(settings: AppSettings, templates: DocumentTemplate[]): string[] {
  const ids = [settings.defaultQuoteTemplateId, settings.defaultContractTemplateId, settings.defaultInvoiceTemplateId].filter(Boolean);
  const fields = ids.flatMap((id) => {
    const template = templates.find((candidate) => candidate._id === id && candidate.active !== false);
    return parseRequiredFields(template?.requiredFieldsCsv);
  });
  return [...new Set(fields)];
}

async function loadActiveAssets(): Promise<Asset[]> {
  const result = await elevatedFind(elevatedQuery(ASSETS).ne('active', false).ne('status', 'INACTIVE').limit(1000));
  return result.items as Asset[];
}

async function loadActiveCatalog(): Promise<BookingCatalogItem[]> {
  const result = await elevatedFind(elevatedQuery(CATALOG).ne('active', false).limit(1000));
  return (result.items || []).filter((item: BookingCatalogItem) => item.active !== false) as BookingCatalogItem[];
}

function pricingOptions(plan: RentalFlowPlan) {
  return {
    allowWeekly: hasFeature(plan, 'WEEKLY_PRICING'),
    allowMonthly: hasFeature(plan, 'MONTHLY_PRICING'),
    allowLongTermDiscount: hasFeature(plan, 'LONG_TERM_DISCOUNT'),
  };
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

function publicAsset(
  asset: Asset,
  plan: RentalFlowPlan,
  start?: Date,
  end?: Date,
  settings?: AppSettings,
  blockingItems: ReservationItem[] = []
) {
  const before = settings?.defaultBufferBeforeHours || 0;
  const after = settings?.defaultBufferAfterHours || 0;
  let available: boolean | null = null;
  let billableDays = 0;
  let lineTotalCents = 0;
  let pricingMode = '';

  if (asset._id && start && end && settings) {
    available = isAssetAvailable(asset._id, start, end, before, after, blockingItems);
    try {
      const price = calculateRentalPrice(asset, start, end, pricingOptions(plan));
      billableDays = price.billableDays;
      lineTotalCents = price.totalCents;
      pricingMode = price.pricingMode;
    } catch {
      available = false;
    }
  }

  return {
    id: asset._id || '',
    imageUrl: bookingImageUrl(asset.image),
    title: asset.title || 'Équipement',
    productType: asset.productType || '',
    categoryId: asset.categoryId || '',
    categoryName: asset.categoryName || '',
    catalogTagsJson: asset.catalogTagsJson || '[]',
    currency: asset.currency || settings?.currency || 'CAD',
    dailyRateCents: asset.dailyRateCents || 0,
    weeklyRateCents: hasFeature(plan, 'WEEKLY_PRICING') ? asset.weeklyRateCents || 0 : 0,
    monthlyRateCents: hasFeature(plan, 'MONTHLY_PRICING') ? asset.monthlyRateCents || 0 : 0,
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
    const [{ settings, templates }, assets, catalog, plan] = await Promise.all([
      loadSettingsAndTemplates(),
      loadActiveAssets(),
      loadActiveCatalog(),
      loadCurrentPlan(request),
    ]);

    let start: Date | undefined;
    let end: Date | undefined;
    let blockingItems: ReservationItem[] = [];
    let catalogBlockingItems: ReservationItem[] = [];
    if (startValue && endValue) {
      const period = validatePeriod(startValue, endValue);
      start = period.start;
      end = period.end;
      [blockingItems, catalogBlockingItems] = await Promise.all([
        loadBlockingItems(start, end, settings.defaultBufferBeforeHours || 0, settings.defaultBufferAfterHours || 0),
        loadCatalogBlockingItems(start, end),
      ]);
    }

    if (!hasAppAccess(plan)) return json({ error: 'Un abonnement RentalFlow actif est requis.' }, 402, request);

    const paymentsEnabled = hasFeature(plan, 'PAYMENTS');
    const depositEnabled = paymentsEnabled && hasFeature(plan, 'SECURITY_DEPOSIT') && settings.defaultDepositEnabled === true;
    const currency = settings.currency || 'CAD';

    return json({
      company: { name: settings.companyName || 'Location en ligne', logoUrl: settings.logoUrl || '' },
      hero: {
        title: settings.bookingHeroTitle || '',
        subtitle: settings.bookingHeroSubtitle || '',
        backgroundUrl: bookingImageUrl(settings.bookingHeroBackgroundUrl),
      },
      settings: {
        theme: normalizeBookingTheme(settings.bookingThemeJson),
        currency,
        taxesEnabled: settings.taxesEnabled !== false,
        tax1Name: settings.tax1Name || '',
        tax1Rate: settings.tax1Rate || 0,
        tax2Name: settings.tax2Name || '',
        tax2Rate: settings.tax2Rate || 0,
        tax2Compound: settings.tax2Compound === true,
        paymentsEnabled,
        depositEnabled,
        depositType: settings.defaultDepositType || 'PERCENT',
        depositValue: settings.defaultDepositValue || 0,
        requiredFields: requiredFieldsForDefaults(settings, templates),
      },
      assets: assets.map((asset) => publicAsset(asset, plan, start, end, settings, blockingItems)),
      catalogItems: catalog.map((item) => publicCatalogItem(item, currency, catalogBlockingItems)),
    }, 200, request);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return json({ error: 'Unauthorized' }, 401, request);
    if (error instanceof Error && ['INVALID_PERIOD', 'PERIOD_TOO_LONG', 'PAST_PERIOD'].includes(error.message)) return json({ error: error.message }, 400, request);
    console.error('RentalFlow public booking GET failed', error);
    return json({ error: 'Impossible de charger la réservation en ligne.' }, 500, request);
  }
};

export const POST: APIRoute = async ({ request }) => {
  let createdBooking: CreatedOnlineReservation | null = null;
  let acquiredLocks: BookingLock[] = [];
  let acquiredCatalogStockLocks: CatalogStockLock[] = [];

  try {
    await requireAppInstance();
    const body = await request.json() as BookingRequest;
    const { start, end } = validatePeriod(body.startDateTime, body.endDateTime);
    const assetIds = [...new Set((body.assetIds || []).map((id) => clean(id, 80)).filter(Boolean))];
    if (!assetIds.length || assetIds.length > MAX_PUBLIC_ASSETS) return json({ error: 'Sélection d’équipement invalide.' }, 400);

    let requestedCatalog: Map<string, number>;
    try {
      requestedCatalog = parseCatalogSelections(body.catalogItems);
    } catch {
      return json({ error: 'Sélection d’extras invalide.' }, 400);
    }

    const customer = normalizePublicCustomer(body.customer);
    try {
      validatePublicCustomer(customer);
    } catch (error) {
      if (error instanceof Error && error.message === 'CUSTOMER_NAME_REQUIRED') {
        return json({ error: 'Le nom du client est obligatoire.' }, 400);
      }
      return json({ error: 'Un courriel valide est obligatoire.' }, 400);
    }

    const [{ settings, templates }, activeAssets, activeCatalog, plan] = await Promise.all([
      loadSettingsAndTemplates(),
      loadActiveAssets(),
      loadActiveCatalog(),
      loadCurrentPlan(request),
    ]);

    if (!hasAppAccess(plan)) return json({ error: 'Votre essai RentalFlow est terminé. Un forfait Starter, Business ou Pro est requis.' }, 402, request);

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

    acquiredLocks = await acquireBookingLocks(assetIds);

    const before = settings.defaultBufferBeforeHours || 0;
    const after = settings.defaultBufferAfterHours || 0;
    const blockingItems = await loadBlockingItems(start, end, before, after, assetIds);
    for (const asset of selectedAssets) {
      if (!asset._id || !isAssetAvailable(asset._id, start, end, before, after, blockingItems)) {
        return json({ error: `${asset.title || 'Un équipement'} n’est plus disponible pour cette période.` }, 409);
      }
    }

    const priceLines = selectedAssets.map((asset) => ({ asset, ...calculateRentalPrice(asset, start, end, pricingOptions(plan)) }));
    const currency = priceLines[0]?.asset.currency || settings.currency || 'CAD';

    let selectedCatalogItems: BookingCatalogItem[];
    try {
      selectedCatalogItems = catalogItemsForReservation(activeCatalog, selectedAssets, requestedCatalog);
    } catch {
      return json({ error: 'Un extra sélectionné n’est pas compatible avec cette réservation.' }, 400);
    }

    const stockTrackedCatalogIds = stockTrackedCatalogItemIds(selectedCatalogItems);

    acquiredCatalogStockLocks = await acquireCatalogStockLocks(stockTrackedCatalogIds);

    let catalogLines: ReservationCatalogLine[];
    try {
      const catalogBlockingItems = stockTrackedCatalogIds.length
        ? await loadCatalogBlockingItems(start, end, stockTrackedCatalogIds)
        : [];
      catalogLines = resolveCatalogLines(
        selectedCatalogItems,
        requestedCatalog,
        start,
        end,
        currency,
        catalogBlockingItems,
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'CATALOG_OUT_OF_STOCK') {
        return json({ error: 'Un extra sélectionné n’est plus disponible dans la quantité demandée.' }, 409);
      }
      throw error;
    }

    const rentalFinanceLines: ReservationCatalogLine[] = priceLines.map((line) => ({
      lineType: 'RENTAL',
      assetId: line.asset._id,
      itemName: line.asset.title || '',
      quantity: 1,
      taxable: true,
      billableDays: line.billableDays,
      pricingMode: line.pricingMode,
      lineTotalCents: line.totalCents,
      currency: line.asset.currency || currency,
    }));
    const finance = computeReservationFinancials([...rentalFinanceLines, ...catalogLines], 0, settings);

    const paymentsEnabled = hasFeature(plan, 'PAYMENTS');
    const depositsEnabled = paymentsEnabled && hasFeature(plan, 'SECURITY_DEPOSIT') && settings.defaultDepositEnabled === true;
    const paymentMode: PaymentMode = !paymentsEnabled ? 'NONE' : body.paymentMode === 'DEPOSIT' && depositsEnabled ? 'DEPOSIT' : 'FULL';
    const depositType = settings.defaultDepositType || 'PERCENT';
    const depositValue = settings.defaultDepositValue || 0;
    const depositResult = calculateDeposit(finance.totalCents, paymentMode, depositType, depositValue);

    const bookingCustomer = await findOrCreatePublicCustomer(customer);

    const documentsEnabled = hasFeature(plan, 'DOCUMENTS');
    const quoteTemplate = documentsEnabled ? templates.find((template) => template._id === settings.defaultQuoteTemplateId && template.active !== false) : undefined;
    const contractTemplate = documentsEnabled ? templates.find((template) => template._id === settings.defaultContractTemplateId && template.active !== false) : undefined;
    const invoiceTemplate = documentsEnabled ? templates.find((template) => template._id === settings.defaultInvoiceTemplateId && template.active !== false) : undefined;

    createdBooking = await createOnlineReservation({
      customer,
      bookingCustomer,
      settings,
      quoteTemplate,
      contractTemplate,
      invoiceTemplate,
      start,
      end,
      beforeHours: before,
      afterHours: after,
      paymentsEnabled,
      paymentMode,
      depositType,
      depositValue,
      deposit: depositResult,
      finance,
      currency,
      notes: clean(body.notes, 1000),
      priceLines,
      catalogLines,
    });

    const { reservation: createdReservation, reservationNumber } = createdBooking;

    const amount = depositResult.amountDueNowCents;
    if (!paymentsEnabled || amount <= 0) {
      return json({
        reservationNumber,
        totalCents: finance.totalCents,
        amountDueNowCents: 0,
        balanceDueCents: finance.totalCents,
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
      paymentNumber: generateReferenceNumber('PAY'),
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
      remainingBalanceCents: Math.max(0, finance.totalCents - amount),
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
      totalCents: finance.totalCents,
      amountDueNowCents: amount,
      balanceDueCents: Math.max(0, finance.totalCents - amount),
      currency,
      checkoutUrl,
    }, 201);
  } catch (error) {
    console.error('RentalFlow public booking POST failed', error);

    if (createdBooking) {
      try {
        await rollbackReservationCreation(createdBooking);
      } catch (rollbackError) {
        console.error('RentalFlow public booking rollback failed', rollbackError);
      }
    }

    if (error instanceof Error && error.message === 'UNAUTHORIZED') return json({ error: 'Unauthorized' }, 401, request);
    if (error instanceof Error && error.message === 'BOOKING_BUSY') return json({ error: 'Cette disponibilité est en cours de réservation. Réessayez dans quelques secondes.' }, 409);
    if (error instanceof Error && error.message === 'CATALOG_STOCK_BUSY') return json({ error: 'Le stock d’un extra est en cours de réservation. Réessayez dans quelques secondes.' }, 409);
    if (error instanceof Error && ['INVALID_PERIOD', 'PERIOD_TOO_LONG', 'PAST_PERIOD'].includes(error.message)) return json({ error: error.message }, 400, request);
    if (error instanceof Error && error.message.startsWith('PAYLINK')) return json({ error: 'La réservation n’a pas été confirmée parce que le paiement Wix n’a pas pu être préparé.' }, 502);
    return json({ error: 'Impossible de compléter la réservation en ligne.' }, 500);
  } finally {
    await releaseCatalogStockLocks(acquiredCatalogStockLocks);
    await releaseBookingLocks(acquiredLocks);
  }
};
