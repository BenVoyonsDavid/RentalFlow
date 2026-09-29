import type { PaymentMode } from './reservation-finance';

export function onlinePaymentLabel(paymentMode: PaymentMode): string {
  return paymentMode === 'DEPOSIT'
    ? 'Dépôt de réservation'
    : 'Paiement de location';
}

export function onlinePaymentBalance(totalCents: number, amountCents: number): number {
  return Math.max(
    0,
    Math.round(Number(totalCents) || 0) - Math.max(0, Math.round(Number(amountCents) || 0)),
  );
}

export function extractPaymentLinkId(response: any): string {
  const link = response?.paymentLink || response;
  return String(link?._id || link?.id || '');
}

export function extractPaymentLinkUrl(response: any): string {
  const link = response?.paymentLink || response;

  return String(
    link?.links?.find?.((entry: any) => entry?.url?.url)?.url?.url
      || link?.links?.find?.((entry: any) => typeof entry?.url === 'string')?.url
      || link?.url?.url
      || link?.url
      || '',
  );
}

export function extractInitiatedCheckout(response: any): {
  checkoutUrl: string;
  checkoutId: string;
} {
  return {
    checkoutUrl: String(
      response?.ecomCheckout?.checkoutUrl
        || response?.checkoutUrl
        || '',
    ),
    checkoutId: String(
      response?.ecomCheckout?.checkoutId
        || response?.checkoutId
        || '',
    ),
  };
}
