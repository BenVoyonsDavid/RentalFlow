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

async function elevatedFind(query: any): Promise<any> {
  return query.find({ consistentRead: true });
}

async function elevatedUpdate(collectionId: string, item: Record<string, unknown>): Promise<any> {
  const update = auth.elevate(items.update);
  const itemId = item._id;
  if (typeof itemId !== 'string' || !itemId) throw new Error('MISSING_ITEM_ID');
  return update(collectionId, { ...item, _id: itemId });
}

async function cancelLocalPaymentByLinkId(paymentLinkId: string, reason: string): Promise<void> {
  if (!paymentLinkId) return;

  const result = await elevatedFind(
    items.query(PAYMENTS)
      .eq('wixPaymentLinkId', paymentLinkId)
      .limit(5),
  );

  for (const payment of result.items || []) {
    if (!payment?._id) continue;
    await elevatedUpdate(PAYMENTS, {
      ...payment,
      status: 'CANCELLED',
      remainingBalanceCents: Math.max(0, Number(payment.remainingBalanceCents) || 0),
      notes: [payment.notes, reason].filter(Boolean).join(' '),
    });
  }
}

async function compensatePaymentLink(api: any, paymentLinkId: string): Promise<void> {
  if (!paymentLinkId) return;

  let deactivated = false;
  if (typeof api?.deactivatePaymentLink === 'function') {
    try {
      const deactivate = auth.elevate(api.deactivatePaymentLink);
      await deactivate(paymentLinkId);
      deactivated = true;
    } catch (error) {
      console.error(`RentalFlow could not deactivate Wix Payment Link ${paymentLinkId}.`, error);
    }
  }

  if (typeof api?.deletePaymentLink === 'function') {
    try {
      const remove = auth.elevate(api.deletePaymentLink);
      await remove(paymentLinkId);
      return;
    } catch (error) {
      console.error(`RentalFlow could not delete Wix Payment Link ${paymentLinkId}.`, error);
    }
  }

  if (!deactivated) {
    throw new Error('PAYLINK_COMPENSATION_FAILED');
  }
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
  let paymentLinkId = '';

  try {
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

    paymentLinkId = extractPaymentLinkId(paymentLinkResponse);
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

    if (!checkoutUrl) throw new Error('PAYLINK_NO_URL');

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

    try {
      await elevatedInsert(ACTIVITY, {
        reservationId: input.reservationId,
        reservationNumber: input.reservationNumber,
        actionType: 'ONLINE_PAYMENT_LINK_CREATED',
        description: `${label} créé pour ${(amount / 100).toFixed(2)} ${input.currency}.`,
        actor: 'RentalFlow Online Booking',
        eventDate: new Date(),
      });
    } catch (error) {
      console.error(
        `RentalFlow could not record activity for Wix Payment Link ${paymentLinkId}.`,
        error,
      );
    }

    return {
      checkoutUrl,
      checkoutId,
      paymentLinkId,
      amountDueNowCents: amount,
      balanceDueCents,
    };
  } catch (error) {
    if (paymentLinkId) {
      const reason = 'Lien Wix annulé automatiquement après échec de finalisation de la réservation.';
      try {
        await cancelLocalPaymentByLinkId(paymentLinkId, reason);
      } catch (localError) {
        console.error(
          `RentalFlow could not mark local payment for Wix Payment Link ${paymentLinkId} as cancelled.`,
          localError,
        );
      }

      await compensatePaymentLink(api, paymentLinkId);
    }

    throw error;
  }
}
