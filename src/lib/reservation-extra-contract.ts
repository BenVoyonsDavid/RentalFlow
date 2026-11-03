import type { Reservation, ReservationItem } from '../domain/types';

export type ReservationExtraAction = 'ADD' | 'REMOVE';

export type ReservationExtraRequest = {
  action?: ReservationExtraAction;
  reservationId?: string;
  catalogItemId?: string;
  reservationItemId?: string;
  quantityToAdd?: number;
};

export type ReservationExtraSuccess = {
  reservation: Reservation;
  item?: ReservationItem;
  removedItemId?: string;
};

export class ReservationExtraHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ReservationExtraHttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
