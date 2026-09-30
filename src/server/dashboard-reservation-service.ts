import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import type {
  Asset,
  BookingLock,
  Customer,
  DocumentTemplate,
} from '../domain/types';
import { isAssetAvailable } from '../lib/asset-availability';
import { bookingPricingOptions } from '../lib/booking-assets';
import { normalizePublicCustomer } from '../lib/booking-customer';
import {
  DashboardReservationHttpError,
  type DashboardReservationRequest,
  type DashboardReservationSuccess,
} from '../lib/dashboard-reservation-contract';
import { COLLECTIONS } from '../lib/collection-ids';
import { hasAppAccess, hasFeature } from '../lib/plans';
import { generateReferenceNumber } from '../lib/reference-number';
import { calculateRentalPrice } from '../lib/rental-pricing';
import {
  calculateDeposit,
  parseRequiredFields,
  validateRequiredFields,
  type DepositType,
  type PaymentMode,
} from '../lib/reservation-finance';
import {
  computeReservationFinancials,
  type ReservationCatalogLine,
} from '../lib/reservation-catalog';
import {
  acquireBookingLocks,
  loadBlockingItems,
  releaseBookingLocks,
} from './booking-availability';
import {
  loadActiveAssets,
  loadCurrentPlan,
  loadSettingsAndTemplates,
} from './public-booking-context';
import {
  createOnlineReservation,
  type CreatedOnlineReservation,
} from './reservation-service';

const CUSTOMERS = COLLECTIONS.customers;
const MAX_DASHBOARD_ASSETS = 100;

function clean(value: unknown, max = 200): string {
  return String(value ?? '').trim().slice(0, max);
}

function nonNegativeNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function elevatedQuery(collectionId: string): any {
  const query = auth.elevate(items.query);
  return query(collectionId);
}

async function elevatedFind(query: any): Promise<any> {
  return query.find({ consistentRead: true });
}

async function elevatedInsert(
  collectionId: string,
  item: Record<string, unknown>,
): Promise<any> {
  const insert = auth.elevate(items.insert);
  return insert(collectionId, item);
}

async function elevatedRemove(
  collectionId: string,
  itemId: string,
): Promise<any> {
  const remove = auth.elevate(items.remove);
  return remove(collectionId, itemId);
}

function customerDisplayName(customer: Customer): string {
  return [customer.firstName, customer.lastName]
    .filter(Boolean)
    .join(' ')
    .trim()
    || customer.companyName
    || 'Client';
}

async function loadExistingCustomer(customerId: string): Promise<Customer> {
  const result = await elevatedFind(
    elevatedQuery(CUSTOMERS)
      .eq('_id', customerId)
      .limit(1),
  );
  const customer = result.items?.[0] as Customer | undefined;

  if (!customer?._id || customer.active === false) {
    throw new DashboardReservationHttpError(
      404,
      'Le client sélectionné est introuvable ou inactif.',
    );
  }

  return customer;
}

function selectedTemplate(
  templates: DocumentTemplate[],
  id: unknown,
  label: string,
): DocumentTemplate | undefined {
  const cleanId = clean(id, 80);
  if (!cleanId) return undefined;

  const template = templates.find(
    (candidate) =>
      candidate._id === cleanId
      && candidate.active !== false,
  );

  if (!template) {
    throw new DashboardReservationHttpError(
      400,
      `Le modèle de ${label} sélectionné est invalide.`,
    );
  }

  return template;
}

function normalizePeriod(
  startValue: unknown,
  endValue: unknown,
): { start: Date; end: Date } {
  const start = new Date(String(startValue || ''));
  const end = new Date(String(endValue || ''));

  if (
    !start.getTime()
    || !end.getTime()
    || end <= start
  ) {
    throw new DashboardReservationHttpError(
      400,
      'La période de location est invalide.',
    );
  }

  return { start, end };
}

export async function createDashboardReservation(
  request: Request,
  body: DashboardReservationRequest,
): Promise<DashboardReservationSuccess> {
  let acquiredLocks: BookingLock[] = [];
  let createdCustomer: Customer | null = null;
  let createdBooking: CreatedOnlineReservation | null = null;

  try {
    const { start, end } = normalizePeriod(
      body.startDateTime,
      body.endDateTime,
    );

    const assetIds = [
      ...new Set(
        (body.assetIds || [])
          .map((id) => clean(id, 80))
          .filter(Boolean),
      ),
    ];

    if (
      !assetIds.length
      || assetIds.length > MAX_DASHBOARD_ASSETS
    ) {
      throw new DashboardReservationHttpError(
        400,
        'Sélection d’équipement invalide.',
      );
    }

    const [{ settings, templates }, activeAssets, plan] =
      await Promise.all([
        loadSettingsAndTemplates(),
        loadActiveAssets(),
        loadCurrentPlan(request),
      ]);

    if (!hasAppAccess(plan)) {
      throw new DashboardReservationHttpError(
        402,
        'Un abonnement RentalFlow actif est requis.',
      );
    }

    const selectedAssets = assetIds
      .map((id) => activeAssets.find((asset) => asset._id === id))
      .filter((asset): asset is Asset => !!asset);

    if (selectedAssets.length !== assetIds.length) {
      throw new DashboardReservationHttpError(
        409,
        'Un équipement sélectionné est introuvable ou inactif.',
      );
    }

    const currencies = new Set(
      selectedAssets
        .map((asset) => clean(asset.currency || settings.currency || 'CAD', 10).toUpperCase())
        .filter(Boolean),
    );

    if (currencies.size > 1) {
      throw new DashboardReservationHttpError(
        409,
        'Les équipements sélectionnés doivent utiliser la même devise.',
      );
    }

    const documentsEnabled = hasFeature(plan, 'DOCUMENTS');
    const quoteTemplate = documentsEnabled
      ? selectedTemplate(templates, body.quoteTemplateId, 'devis')
      : undefined;
    const contractTemplate = documentsEnabled
      ? selectedTemplate(templates, body.contractTemplateId, 'contrat')
      : undefined;
    const invoiceTemplate = documentsEnabled
      ? selectedTemplate(templates, body.invoiceTemplateId, 'facture')
      : undefined;

    const chosenTemplates = [
      quoteTemplate,
      contractTemplate,
      invoiceTemplate,
    ].filter((template): template is DocumentTemplate => !!template);

    const requiredFields = [
      ...new Set(
        chosenTemplates.flatMap(
          (template) => parseRequiredFields(template.requiredFieldsCsv),
        ),
      ),
    ];

    const customerInput = body.customer || {};
    const mode = customerInput.mode === 'NEW'
      ? 'NEW'
      : 'EXISTING';

    let bookingCustomer: Customer;
    let discountPercent = 0;

    const customerSnapshot = normalizePublicCustomer({
      name: customerInput.name,
      email: customerInput.email,
      phone: customerInput.phone,
      addressLine1: customerInput.addressLine1,
      addressLine2: customerInput.addressLine2,
      city: customerInput.city,
      region: customerInput.region,
      postalCode: customerInput.postalCode,
      country: customerInput.country,
    });

    if (mode === 'EXISTING') {
      const customerId = clean(customerInput.customerId, 80);
      if (!customerId) {
        throw new DashboardReservationHttpError(
          400,
          'Sélectionnez un client existant.',
        );
      }

      bookingCustomer = await loadExistingCustomer(customerId);

      if (!customerSnapshot.name) {
        customerSnapshot.name = customerDisplayName(bookingCustomer);
      }

      if (hasFeature(plan, 'CUSTOMER_DISCOUNT')) {
        discountPercent = Math.min(
          100,
          nonNegativeNumber(bookingCustomer.discountPercent),
        );
      }
    } else {
      if (!customerSnapshot.name) {
        throw new DashboardReservationHttpError(
          400,
          'Le nom du nouveau client est obligatoire.',
        );
      }

      const firstName = clean(customerInput.firstName, 100);
      const lastName = clean(customerInput.lastName, 100);
      const companyName = clean(customerInput.companyName, 150);

      createdCustomer = await elevatedInsert(CUSTOMERS, {
        customerNumber: generateReferenceNumber('C'),
        firstName,
        lastName,
        companyName,
        email: customerSnapshot.email,
        phone: customerSnapshot.phone,
        addressLine1: customerSnapshot.addressLine1,
        addressLine2: customerSnapshot.addressLine2,
        city: customerSnapshot.city,
        region: customerSnapshot.region,
        postalCode: customerSnapshot.postalCode,
        country: customerSnapshot.country,
        discountPercent: 0,
        active: true,
      }) as Customer;

      if (!createdCustomer._id) {
        throw new DashboardReservationHttpError(
          500,
          'Impossible de créer le client.',
        );
      }

      bookingCustomer = createdCustomer;
    }

    const missing = validateRequiredFields(requiredFields, {
      customerName: customerSnapshot.name,
      customerEmail: customerSnapshot.email,
      customerPhone: customerSnapshot.phone,
      customerAddressLine1: customerSnapshot.addressLine1,
      customerCity: customerSnapshot.city,
      customerRegion: customerSnapshot.region,
      customerPostalCode: customerSnapshot.postalCode,
      customerCountry: customerSnapshot.country,
      startDateTime: body.startDateTime,
      endDateTime: body.endDateTime,
      selectedAssetCount: assetIds.length,
    });

    if (missing.length) {
      throw new DashboardReservationHttpError(
        400,
        `Champs requis par les modèles sélectionnés : ${missing.join(', ')}.`,
      );
    }

    const beforeHours = nonNegativeNumber(body.bufferBeforeHours);
    const afterHours = nonNegativeNumber(body.bufferAfterHours);

    acquiredLocks = await acquireBookingLocks(assetIds);

    const blockingItems = await loadBlockingItems(
      start,
      end,
      beforeHours,
      afterHours,
      assetIds,
    );

    for (const asset of selectedAssets) {
      if (
        !asset._id
        || !isAssetAvailable(
          asset._id,
          start,
          end,
          beforeHours,
          afterHours,
          blockingItems,
        )
      ) {
        throw new DashboardReservationHttpError(
          409,
          `${asset.title || 'Un équipement'} n’est plus disponible pour cette période.`,
        );
      }
    }

    const priceLines = selectedAssets.map((asset) => ({
      asset,
      ...calculateRentalPrice(
        asset,
        start,
        end,
        bookingPricingOptions(plan),
      ),
    }));

    const currency = priceLines[0]?.asset.currency
      || settings.currency
      || 'CAD';

    const rentalFinanceLines: ReservationCatalogLine[] =
      priceLines.map((line) => ({
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

    const finance = computeReservationFinancials(
      rentalFinanceLines,
      discountPercent,
      settings,
    );

    const paymentsEnabled = hasFeature(plan, 'PAYMENTS');
    const depositsEnabled = paymentsEnabled
      && hasFeature(plan, 'SECURITY_DEPOSIT');

    const requestedPaymentMode = body.paymentMode || 'NONE';
    const paymentMode: PaymentMode = !paymentsEnabled
      ? 'NONE'
      : requestedPaymentMode === 'DEPOSIT' && depositsEnabled
        ? 'DEPOSIT'
        : requestedPaymentMode === 'FULL'
          ? 'FULL'
          : 'NONE';

    const depositType: DepositType =
      body.depositType === 'FIXED'
        ? 'FIXED'
        : 'PERCENT';
    const depositValue = nonNegativeNumber(body.depositValue);

    const deposit = calculateDeposit(
      finance.totalCents,
      paymentMode,
      depositType,
      depositValue,
    );

    createdBooking = await createOnlineReservation({
      customer: customerSnapshot,
      bookingCustomer,
      settings,
      quoteTemplate,
      contractTemplate,
      invoiceTemplate,
      start,
      end,
      beforeHours,
      afterHours,
      paymentsEnabled,
      paymentMode,
      depositType,
      depositValue,
      deposit,
      finance,
      currency,
      notes: clean(body.notes, 5000),
      priceLines,
      catalogLines: [],
      customerDiscountPercent: discountPercent,
      workflowStage: 'RESERVATION',
      activityActionType: 'RESERVATION_CREATED',
      activityActor: 'Utilisateur Wix',
    });

    return {
      reservationNumber: createdBooking.reservationNumber,
      reservation: createdBooking.reservation,
    };
  } catch (error) {
    if (!createdBooking && createdCustomer?._id) {
      await elevatedRemove(CUSTOMERS, createdCustomer._id)
        .catch((rollbackError) => {
          console.error(
            'RentalFlow could not roll back a new dashboard customer.',
            rollbackError,
          );
        });
    }

    throw error;
  } finally {
    await releaseBookingLocks(acquiredLocks);
  }
}
