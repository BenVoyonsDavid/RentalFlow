import type { PublicCustomerInput } from './booking-customer';
import type { PublicCatalogSelection } from './booking-catalog';

export const MAX_PUBLIC_ASSETS = 25;

export type BookingRequest = {
  startDateTime?: string;
  endDateTime?: string;
  assetIds?: string[];
  catalogItems?: PublicCatalogSelection[];
  paymentMode?: 'FULL' | 'DEPOSIT';
  customer?: PublicCustomerInput;
  notes?: string;
};

export type PublicBookingSuccess = {
  reservationNumber: string;
  totalCents: number;
  amountDueNowCents: number;
  balanceDueCents: number;
  currency: string;
  checkoutUrl: string;
};

export class PublicBookingHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PublicBookingHttpError';
    this.status = status;
  }
}
