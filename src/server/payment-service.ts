import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import { COLLECTIONS } from '../lib/collection-ids';
import {
  extractInitiatedCheckout,
  extractPaymentLinkId,
  extractPaymentLinkUrl,
  onlinePaymentBalance,
  onlinePaymentLabel,
} from '../lib/booking-payment';
import { generateReferenceNumber } from '../lib/reference-number';
import type { PaymentMode } from '../lib/reservation-finance';

const PAYMENTS = COLLECTIONS.payments;
const ACTIVITY = COLLECTIONS.activityLog;

export type CreateOnlinePaymentInput = {
  reservationId: string;
  reservationNumber: string;
  customerName: string;
  paymentMode: PaymentMode;
  amountCents: number;
  totalCents: number;
  currency: string;
};

export type CreatedOnlinePayment = {
  checkoutUrl: string;
  checkoutId: string;
  paymentLinkId: string;
  amountDueNowCents: number;
  balanceDueCents: number;
};

async function elevatedInsert(collectionId: string, item: Record<string, unknown>): Promise<any> {
  const insert = auth.elevate(items.insert);
  return insert(collectionId, item);
}

export async function createOnlinePayment(
  input: CreateOnlinePaymentInput,
): Promise<CreatedOnlinePayment> {
  const amount = Math.max(0, Math.round(Number(input.amountCents) || 0));
  if (amount <= 0) throw new Error('PAYLINK_INVALID_AMOUNT');

  const wixGetPaid = await import('@wix/get-paid') as any;
  const api = wixGetPaid.paymentLinks;
  if (!api?.createPaymentLink) throw new Error('PAYLINK_UNAVAILABLE');

  const createPaymentLink = auth.elevate(api.createPaymentLink);
  const label = onlinePaymentLabel(input.paymentMode);

  const paymentLinkResponse = await createPaymentLink({
    title: `${input.reservationNumber} — ${label}`,
    description: `Paiement RentalFlow pour ${input.customerName}`,
    currency: input.currency,
    type: 'ECOM',
    paymentsLimit: 1,
    displayData: {},
    ecomPaymentLink: {
      lineItems: [{
        type: 'CUSTOM',
        customItem: {
          name: `${label} ${input.reservationNumber}`,
          quantity: 1,
          price: (amount / 100).toFixed(2),
        },
      }],
    },
  });

  const paymentLinkId = extractPaymentLinkId(paymentLinkResponse);
  if (!paymentLinkId) throw new Error('PAYLINK_NO_ID');

  let checkoutUrl = extractPaymentLinkUrl(paymentLinkResponse);
  let checkoutId = '';

  if (!checkoutUrl && api.initiatePayment) {
    const initiatePayment = auth.elevate(api.initiatePayment);
    const initiated = await initiatePayment(paymentLinkId);
    const checkout = extractInitiatedCheckout(initiated);
    checkoutUrl = checkout.checkoutUrl;
    checkoutId = checkout.checkoutId;
  }

  const balanceDueCents = onlinePaymentBalance(input.totalCents, amount);

  await elevatedInsert(PAYMENTS, {
    reservationId: input.reservationId,
    reservationNumber: input.reservationNumber,
    paymentNumber: generateReferenceNumber('PAY'),
    paymentType: input.paymentMode === 'DEPOSIT' ? 'BOOKING_DEPOSIT' : 'PAYMENT',
    method: 'WIX',
    status: 'PENDING',
    amountCents: amount,
    currency: input.currency,
    paymentDate: new Date(),
    reference: label,
    wixPaymentLinkId: paymentLinkId,
    wixPaymentUrl: checkoutUrl,
    wixCheckoutId: checkoutId,
    wixOnlinePayment: true,
    remainingBalanceCents: balanceDueCents,
    notes: 'Lien de paiement Wix créé depuis la réservation en ligne RentalFlow.',
  });

  await elevatedInsert(ACTIVITY, {
    reservationId: input.reservationId,
    reservationNumber: input.reservationNumber,
    actionType: 'ONLINE_PAYMENT_LINK_CREATED',
    description: `${label} créé pour ${(amount / 100).toFixed(2)} ${input.currency}.`,
    actor: 'RentalFlow Online Booking',
    eventDate: new Date(),
  });

  return {
    checkoutUrl,
    checkoutId,
    paymentLinkId,
    amountDueNowCents: amount,
    balanceDueCents,
  };
}
