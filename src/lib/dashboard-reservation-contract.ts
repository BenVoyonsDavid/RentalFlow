import type {
  DepositType,
  PaymentMode,
  Reservation,
} from '../domain/types';

export type DashboardReservationCustomerInput = {
  mode?: 'EXISTING' | 'NEW';
  customerId?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
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

export type DashboardReservationRequest = {
  customer?: DashboardReservationCustomerInput;
  startDateTime?: string;
  endDateTime?: string;
  assetIds?: string[];
  bufferBeforeHours?: number;
  bufferAfterHours?: number;
  quoteTemplateId?: string;
  contractTemplateId?: string;
  invoiceTemplateId?: string;
  paymentMode?: PaymentMode;
  depositType?: DepositType;
  depositValue?: number;
  notes?: string;
};

export type DashboardReservationSuccess = {
  reservationNumber: string;
  reservation: Reservation;
};

export class DashboardReservationHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'DashboardReservationHttpError';
    this.status = status;
  }
}
