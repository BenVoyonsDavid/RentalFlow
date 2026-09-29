import type { Asset, BookingLock, CatalogStockLock, ReservationItem } from '../domain/types';
import { isAssetAvailable } from '../lib/asset-availability';
import { bookingPricingOptions } from '../lib/booking-assets';
import {
  catalogItemsForReservation,
  parseCatalogSelections,
  resolveCatalogLines,
  stockTrackedCatalogItemIds,
  type BookingCatalogItem,
} from '../lib/booking-catalog';
import {
  normalizePublicCustomer,
  validatePublicCustomer,
} from '../lib/booking-customer';
import {
  MAX_PUBLIC_ASSETS,
  PublicBookingHttpError,
  type BookingRequest,
  type PublicBookingSuccess,
} from '../lib/public-booking-contract';
import {
  requiredFieldsForDefaults,
  validateBookingPeriod,
} from '../lib/public-booking-config';
import { buildPublicBookingPayload } from '../lib/public-booking-view';
import { hasAppAccess, hasFeature } from '../lib/plans';
import { calculateRentalPrice } from '../lib/rental-pricing';
import {
  calculateDeposit,
  validateRequiredFields,
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
  acquireCatalogStockLocks,
  loadCatalogBlockingItems,
  releaseCatalogStockLocks,
} from './catalog-stock';
import { findOrCreatePublicCustomer } from './customer-service';
import { createOnlinePayment } from './payment-service';
import {
  createOnlineReservation,
  rollbackReservationCreation,
  type CreatedOnlineReservation,
} from './reservation-service';
import {
  loadActiveAssets,
  loadActiveCatalog,
  loadCurrentPlan,
  loadSettingsAndTemplates,
} from './public-booking-context';

function clean(value: unknown, max = 200): string {
  return String(value ?? '').trim().slice(0, max);
}

export async function loadPublicBooking(
  request: Request,
): Promise<ReturnType<typeof buildPublicBookingPayload>> {
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
    const period = validateBookingPeriod(startValue, endValue);
    start = period.start;
    end = period.end;

    [blockingItems, catalogBlockingItems] = await Promise.all([
      loadBlockingItems(
        start,
        end,
        settings.defaultBufferBeforeHours || 0,
        settings.defaultBufferAfterHours || 0,
      ),
      loadCatalogBlockingItems(start, end),
    ]);
  }

  if (!hasAppAccess(plan)) {
    throw new PublicBookingHttpError(
      402,
      'Un abonnement RentalFlow actif est requis.',
    );
  }

  return buildPublicBookingPayload({
    settings,
    templates,
    assets,
    catalog,
    plan,
    start,
    end,
    blockingItems,
    catalogBlockingItems,
  });
}

export async function submitPublicBooking(
  request: Request,
  body: BookingRequest,
): Promise<PublicBookingSuccess> {
  let createdBooking: CreatedOnlineReservation | null = null;
  let acquiredLocks: BookingLock[] = [];
  let acquiredCatalogStockLocks: CatalogStockLock[] = [];

  try {
    const { start, end } = validateBookingPeriod(
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

    if (!assetIds.length || assetIds.length > MAX_PUBLIC_ASSETS) {
      throw new PublicBookingHttpError(
        400,
        'Sélection d’équipement invalide.',
      );
    }

    let requestedCatalog: Map<string, number>;
    try {
      requestedCatalog = parseCatalogSelections(body.catalogItems);
    } catch {
      throw new PublicBookingHttpError(
        400,
        'Sélection d’extras invalide.',
      );
    }

    const customer = normalizePublicCustomer(body.customer);
    try {
      validatePublicCustomer(customer);
    } catch (error) {
      if (
        error instanceof Error
        && error.message === 'CUSTOMER_NAME_REQUIRED'
      ) {
        throw new PublicBookingHttpError(
          400,
          'Le nom du client est obligatoire.',
        );
      }

      throw new PublicBookingHttpError(
        400,
        'Un courriel valide est obligatoire.',
      );
    }

    const [{ settings, templates }, activeAssets, activeCatalog, plan] =
      await Promise.all([
        loadSettingsAndTemplates(),
        loadActiveAssets(),
        loadActiveCatalog(),
        loadCurrentPlan(request),
      ]);

    if (!hasAppAccess(plan)) {
      throw new PublicBookingHttpError(
        402,
        'Votre essai RentalFlow est terminé. Un forfait Starter, Business ou Pro est requis.',
      );
    }

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

    if (missing.length) {
      throw new PublicBookingHttpError(
        400,
        `Informations requises : ${missing.join(', ')}.`,
      );
    }

    const selectedAssets = assetIds
      .map((id) => activeAssets.find((asset) => asset._id === id))
      .filter((asset): asset is Asset => !!asset);

    if (selectedAssets.length !== assetIds.length) {
      throw new PublicBookingHttpError(
        409,
        'Un équipement sélectionné n’est plus disponible.',
      );
    }

    acquiredLocks = await acquireBookingLocks(assetIds);

    const before = settings.defaultBufferBeforeHours || 0;
    const after = settings.defaultBufferAfterHours || 0;
    const blockingItems = await loadBlockingItems(
      start,
      end,
      before,
      after,
      assetIds,
    );

    for (const asset of selectedAssets) {
      if (
        !asset._id
        || !isAssetAvailable(
          asset._id,
          start,
          end,
          before,
          after,
          blockingItems,
        )
      ) {
        throw new PublicBookingHttpError(
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

    let selectedCatalogItems: BookingCatalogItem[];
    try {
      selectedCatalogItems = catalogItemsForReservation(
        activeCatalog,
        selectedAssets,
        requestedCatalog,
      );
    } catch {
      throw new PublicBookingHttpError(
        400,
        'Un extra sélectionné n’est pas compatible avec cette réservation.',
      );
    }

    const stockTrackedCatalogIds =
      stockTrackedCatalogItemIds(selectedCatalogItems);

    acquiredCatalogStockLocks =
      await acquireCatalogStockLocks(stockTrackedCatalogIds);

    let catalogLines: ReservationCatalogLine[];
    try {
      const catalogBlockingItems = stockTrackedCatalogIds.length
        ? await loadCatalogBlockingItems(
            start,
            end,
            stockTrackedCatalogIds,
          )
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
      if (
        error instanceof Error
        && error.message === 'CATALOG_OUT_OF_STOCK'
      ) {
        throw new PublicBookingHttpError(
          409,
          'Un extra sélectionné n’est plus disponible dans la quantité demandée.',
        );
      }

      throw error;
    }

    const rentalFinanceLines: ReservationCatalogLine[] = priceLines.map(
      (line) => ({
        lineType: 'RENTAL',
        assetId: line.asset._id,
        itemName: line.asset.title || '',
        quantity: 1,
        taxable: true,
        billableDays: line.billableDays,
        pricingMode: line.pricingMode,
        lineTotalCents: line.totalCents,
        currency: line.asset.currency || currency,
      }),
    );

    const finance = computeReservationFinancials(
      [...rentalFinanceLines, ...catalogLines],
      0,
      settings,
    );

    const paymentsEnabled = hasFeature(plan, 'PAYMENTS');
    const depositsEnabled = paymentsEnabled
      && hasFeature(plan, 'SECURITY_DEPOSIT')
      && settings.defaultDepositEnabled === true;

    const paymentMode: PaymentMode = !paymentsEnabled
      ? 'NONE'
      : body.paymentMode === 'DEPOSIT' && depositsEnabled
        ? 'DEPOSIT'
        : 'FULL';

    const depositType = settings.defaultDepositType || 'PERCENT';
    const depositValue = settings.defaultDepositValue || 0;
    const depositResult = calculateDeposit(
      finance.totalCents,
      paymentMode,
      depositType,
      depositValue,
    );

    const bookingCustomer = await findOrCreatePublicCustomer(customer);

    const documentsEnabled = hasFeature(plan, 'DOCUMENTS');
    const quoteTemplate = documentsEnabled
      ? templates.find(
          (template) =>
            template._id === settings.defaultQuoteTemplateId
            && template.active !== false,
        )
      : undefined;
    const contractTemplate = documentsEnabled
      ? templates.find(
          (template) =>
            template._id === settings.defaultContractTemplateId
            && template.active !== false,
        )
      : undefined;
    const invoiceTemplate = documentsEnabled
      ? templates.find(
          (template) =>
            template._id === settings.defaultInvoiceTemplateId
            && template.active !== false,
        )
      : undefined;

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

    const {
      reservation: createdReservation,
      reservationNumber,
    } = createdBooking;

    const amount = depositResult.amountDueNowCents;

    if (!paymentsEnabled || amount <= 0) {
      return {
        reservationNumber,
        totalCents: finance.totalCents,
        amountDueNowCents: 0,
        balanceDueCents: finance.totalCents,
        currency,
        checkoutUrl: '',
      };
    }

    const payment = await createOnlinePayment({
      reservationId: createdReservation._id || '',
      reservationNumber,
      customerName: customer.name,
      paymentMode,
      amountCents: amount,
      totalCents: finance.totalCents,
      currency,
    });

    return {
      reservationNumber,
      totalCents: finance.totalCents,
      amountDueNowCents: payment.amountDueNowCents,
      balanceDueCents: payment.balanceDueCents,
      currency,
      checkoutUrl: payment.checkoutUrl,
    };
  } catch (error) {
    if (createdBooking) {
      try {
        await rollbackReservationCreation(createdBooking);
      } catch (rollbackError) {
        console.error(
          'RentalFlow public booking rollback failed',
          rollbackError,
        );
      }
    }

    throw error;
  } finally {
    await releaseCatalogStockLocks(acquiredCatalogStockLocks);
    await releaseBookingLocks(acquiredLocks);
  }
}
