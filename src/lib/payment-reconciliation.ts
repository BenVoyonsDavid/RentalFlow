import type { Payment } from '../domain/types';

/**
 * Wix Payment Links represents received money in major currency units.
 * Never infer a settlement amount from a payment count or from our own invoice.
 */
export function wixReceivedAmountCents(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const raw = String(value).trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(raw)) return null;
  const numeric = Number(raw.replace(',', '.'));
  const cents = Math.round(numeric * 100);
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

export type VerifiedWixPayment = {
  amountCents: number;
  transactionId: string;
  paymentDate: Date | null;
};

/**
 * Only count a payment after Wix reports actual money received for this link,
 * in the expected currency, of at least the amount due for this Payment Link.
 * A status or paymentCount alone cannot establish the amount settled.
 */
export function verifiedWixPaymentLink(
  response: unknown,
  payment: Pick<Payment, 'wixPaymentLinkId' | 'amountCents' | 'currency'>,
): VerifiedWixPayment | null {
  const root = response as any;
  const link = root?.paymentLink || root;
  if (!link || typeof link !== 'object') return null;
  const expectedAmount = Number(payment.amountCents);
  if (!Number.isSafeInteger(expectedAmount) || expectedAmount <= 0) return null;

  const expectedId = String(payment.wixPaymentLinkId || '').trim();
  const linkId = String(link._id || link.id || '').trim();
  if (!expectedId || (linkId && linkId !== expectedId)) return null;

  const expectedCurrency = String(payment.currency || '').trim().toUpperCase();
  const actualCurrency = String(link.currency || '').trim().toUpperCase();
  if (!expectedCurrency || (actualCurrency && actualCurrency !== expectedCurrency)) return null;

  const status = String(link.status || '').trim().toUpperCase();
  const receivedCount = Number(link.totalReceived?.paymentCount);
  if (status !== 'PAID' && !(Number.isFinite(receivedCount) && receivedCount > 0)) return null;

  const receivedCents = wixReceivedAmountCents(link.totalReceived?.amount);
  if (receivedCents === null || receivedCents < expectedAmount) return null;

  const date = link.lastPaymentDate ? new Date(link.lastPaymentDate) : null;
  return {
    amountCents: expectedAmount, // Never credit more than this link was for.
    transactionId: String(link.lastTransactionId || link.transactionId || ''),
    paymentDate: date && Number.isFinite(date.getTime()) ? date : null,
  };
}

/**
 * Reservation payments differ from security deposits and damage charges.
 * Only rental charges (and genuine rental refunds) settle rental balance.
 */
export function reservationBalanceCents(
  totalCents: number,
  payments: Pick<Payment, 'status' | 'paymentType' | 'amountCents' | 'currency'>[],
  currency: string,
): number {
  const expectedCurrency = String(currency || '').toUpperCase();
  let receipts = 0;
  let refunds = 0;
  for (const payment of payments) {
    if (payment.status !== 'PAID') continue;
    if (String(payment.currency || '').toUpperCase() !== expectedCurrency) continue;
    const amount = Number(payment.amountCents);
    if (!Number.isSafeInteger(amount) || amount <= 0) continue;
    if (payment.paymentType === 'PAYMENT' || payment.paymentType === 'BOOKING_DEPOSIT') {
      receipts += amount;
    } else if (payment.paymentType === 'REFUND') {
      refunds += amount;
    }
  }
  const netPaid = Math.max(0, receipts - refunds);
  const total = Number(totalCents);
  if (!Number.isSafeInteger(total) || total < 0) return 0;
  return Math.max(0, total - netPaid);
}
