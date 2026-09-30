import type { ReservationItem } from '../domain/types';
import { getBlockedRange, rangesOverlap } from './rental-pricing';

function asDate(value?: Date | string): Date {
  if (value instanceof Date) return value;
  return value ? new Date(value) : new Date(0);
}

export function isAssetAvailable(
  assetId: string,
  start: Date,
  end: Date,
  beforeHours: number,
  afterHours: number,
  blockingItems: ReservationItem[],
): boolean {
  const requested = getBlockedRange(start, end, beforeHours, afterHours);

  return !blockingItems.some((item) => {
    if (item.assetId !== assetId || item.status === 'CANCELLED' || item.status === 'COMPLETED') {
      return false;
    }

    const existingStart = asDate(item.blockedStartDateTime);
    const existingEnd = asDate(item.blockedEndDateTime);
    if (!existingStart.getTime() || !existingEnd.getTime()) return false;

    return rangesOverlap(
      requested.blockedStart,
      requested.blockedEnd,
      existingStart,
      existingEnd,
    );
  });
}
