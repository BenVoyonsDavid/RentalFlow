import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import type {
  AppSettings,
  Asset,
  Customer,
  DocumentTemplate,
  Reservation,
  ReservationItem,
} from '../domain/types';
import type { NormalizedPublicCustomer } from '../lib/booking-customer';
import { COLLECTIONS } from '../lib/collection-ids';
import { generateReferenceNumber } from '../lib/reference-number';
import { getBlockedRange } from '../lib/rental-pricing';
import type { DepositType, PaymentMode } from '../lib/reservation-finance';
import type { ReservationCatalogLine } from '../lib/reservation-catalog';

const RESERVATIONS = COLLECTIONS.reservations;
const RESERVATION_ITEMS = COLLECTIONS.reservationItems;
const ACTIVITY = COLLECTIONS.activityLog;

export type PricedAssetLine = {
  asset: Asset;
  billableDays: number;
  totalCents: number;
  pricingMode: string;
};

export type ReservationFinanceSnapshot = {
  subtotalCents: number;
  discountCents: number;
  preTaxTotalCents: number;
  tax1Cents: number;
  tax2Cents: number;
  taxTotalCents: number;
  totalCents: number;
};

export type ReservationDepositSnapshot = {
  depositAmountCents: number;
  amountDueNowCents: number;
  balanceDueCents: number;
};

export type CreateOnlineReservationInput = {
  customer: NormalizedPublicCustomer;
  bookingCustomer: Customer;
  settings: AppSettings;
  quoteTemplate?: DocumentTemplate;
  contractTemplate?: DocumentTemplate;
  invoiceTemplate?: DocumentTemplate;
  start: Date;
  end: Date;
  beforeHours: number;
  afterHours: number;
  paymentsEnabled: boolean;
  paymentMode: PaymentMode;
  depositType: DepositType;
  depositValue: number;
  deposit: ReservationDepositSnapshot;
  finance: ReservationFinanceSnapshot;
  currency: string;
  notes: string;
  priceLines: PricedAssetLine[];
  catalogLines: ReservationCatalogLine[];
};

export type CreatedOnlineReservation = {
  reservation: Reservation;
  items: ReservationItem[];
  reservationNumber: string;
};

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

export async function rollbackReservationCreation(
  created: CreatedOnlineReservation,
): Promise<void> {
  const reservation = created.reservation;

  if (reservation._id) {
    await elevatedUpdate(RESERVATIONS, {
      ...reservation,
      status: 'CANCELLED',
    });
  }

  for (const item of created.items) {
    if (!item._id) continue;
    await elevatedUpdate(RESERVATION_ITEMS, {
      ...item,
      status: 'CANCELLED',
    });
  }
}

export async function createOnlineReservation(
  input: CreateOnlineReservationInput,
): Promise<CreatedOnlineReservation> {
  const reservationNumber = generateReferenceNumber('RF');
  const createdItems: ReservationItem[] = [];
  let reservation: Reservation | null = null;

  try {
    reservation = await elevatedInsert(RESERVATIONS, {
      reservationNumber,
      customerId: input.bookingCustomer._id || '',
      customerNumber: input.bookingCustomer.customerNumber || '',
      customerName: input.customer.name,
      customerEmail: input.customer.email,
      customerPhone: input.customer.phone,
      customerAddressLine1: input.customer.addressLine1,
      customerAddressLine2: input.customer.addressLine2,
      customerCity: input.customer.city,
      customerRegion: input.customer.region,
      customerPostalCode: input.customer.postalCode,
      customerCountry: input.customer.country,
      startDateTime: input.start,
      endDateTime: input.end,
      bufferBeforeHours: input.beforeHours,
      bufferAfterHours: input.afterHours,
      status: 'CONFIRMED',
      workflowStage: input.paymentsEnabled ? 'PAYMENT' : 'RESERVATION',
      quoteTemplateId: input.quoteTemplate?._id || '',
      quoteTemplateName: input.quoteTemplate?.name || '',
      contractTemplateId: input.contractTemplate?._id || '',
      contractTemplateName: input.contractTemplate?.name || '',
      invoiceTemplateId: input.invoiceTemplate?._id || '',
      invoiceTemplateName: input.invoiceTemplate?.name || '',
      subtotalCents: input.finance.subtotalCents,
      customerDiscountPercent: 0,
      discountCents: input.finance.discountCents,
      preTaxTotalCents: input.finance.preTaxTotalCents,
      tax1Name: input.settings.taxesEnabled === false ? '' : input.settings.tax1Name || '',
      tax1Rate: input.settings.taxesEnabled === false ? 0 : input.settings.tax1Rate || 0,
      tax1Cents: input.finance.tax1Cents,
      tax2Name: input.settings.taxesEnabled === false ? '' : input.settings.tax2Name || '',
      tax2Rate: input.settings.taxesEnabled === false ? 0 : input.settings.tax2Rate || 0,
      tax2Cents: input.finance.tax2Cents,
      taxTotalCents: input.finance.taxTotalCents,
      totalCents: input.finance.totalCents,
      currency: input.currency,
      depositRequired: input.paymentMode === 'DEPOSIT',
      depositType: input.depositType,
      depositValue: input.depositValue,
      depositAmountCents: input.deposit.depositAmountCents,
      amountDueNowCents: input.deposit.amountDueNowCents,
      balanceDueCents: input.deposit.balanceDueCents,
      paymentMode: input.paymentMode,
      notes: input.notes,
    }) as Reservation;

    const blocked = getBlockedRange(
      input.start,
      input.end,
      input.beforeHours,
      input.afterHours,
    );

    for (const line of input.priceLines) {
      if (!line.asset._id) continue;

      const createdItem = await elevatedInsert(RESERVATION_ITEMS, {
        reservationId: reservation._id,
        reservationNumber,
        lineType: 'RENTAL',
        assetId: line.asset._id,
        assetNumber: line.asset.assetNumber || '',
        assetTitle: line.asset.title || '',
        itemName: line.asset.title || '',
        quantity: 1,
        taxable: true,
        startDateTime: input.start,
        endDateTime: input.end,
        blockedStartDateTime: blocked.blockedStart,
        blockedEndDateTime: blocked.blockedEnd,
        bufferBeforeHours: input.beforeHours,
        bufferAfterHours: input.afterHours,
        billableDays: line.billableDays,
        lineTotalCents: line.totalCents,
        pricingMode: line.pricingMode,
        currency: line.asset.currency || input.currency,
        status: 'CONFIRMED',
      }) as ReservationItem;

      createdItems.push(createdItem);
    }

    for (const line of input.catalogLines) {
      const createdItem = await elevatedInsert(RESERVATION_ITEMS, {
        reservationId: reservation._id,
        reservationNumber,
        ...line,
        startDateTime: input.start,
        endDateTime: input.end,
        status: 'CONFIRMED',
      }) as ReservationItem;

      createdItems.push(createdItem);
    }

    try {
      await elevatedInsert(ACTIVITY, {
        reservationId: reservation._id,
        reservationNumber,
        actionType: 'ONLINE_RESERVATION_CREATED',
        description: input.catalogLines.length
          ? `Réservation en ligne ${reservationNumber} créée par ${input.customer.name} avec ${input.catalogLines.length} extra(s).`
          : `Réservation en ligne ${reservationNumber} créée par ${input.customer.name}.`,
        actor: 'Client en ligne',
        eventDate: new Date(),
      });
    } catch (activityError) {
      console.error(
        `RentalFlow could not record activity for reservation ${reservationNumber}.`,
        activityError,
      );
    }

    return {
      reservation,
      items: createdItems,
      reservationNumber,
    };
  } catch (error) {
    if (reservation) {
      try {
        await rollbackReservationCreation({
          reservation,
          items: createdItems,
          reservationNumber,
        });
      } catch (rollbackError) {
        console.error('RentalFlow reservation creation rollback failed', rollbackError);
      }
    }

    throw error;
  }
}
