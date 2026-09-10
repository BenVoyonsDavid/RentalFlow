export type PriceableAsset = {
  dailyRateCents?: number;
  weeklyRateCents?: number;
  monthlyRateCents?: number;
  discountAfterDays?: number;
  discountPercent?: number;
};

export type PricingOptions = {
  allowWeekly: boolean;
  allowMonthly: boolean;
  allowLongTermDiscount: boolean;
};

export type PriceResult = {
  billableDays: number;
  subtotalCents: number;
  totalCents: number;
  pricingMode: string;
  discountPercent: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function getBillableDays(start: Date, end: Date): number {
  const duration = end.getTime() - start.getTime();
  if (duration <= 0) throw new Error('La fin de location doit être après le début.');
  return Math.max(1, Math.ceil(duration / DAY_MS));
}

export function calculateRentalPrice(
  asset: PriceableAsset,
  start: Date,
  end: Date,
  options: PricingOptions
): PriceResult {
  const days = getBillableDays(start, end);
  const daily = Math.max(0, asset.dailyRateCents ?? 0);
  const weekly = options.allowWeekly ? Math.max(0, asset.weeklyRateCents ?? 0) : 0;
  const monthly = options.allowMonthly ? Math.max(0, asset.monthlyRateCents ?? 0) : 0;

  // Dynamic programming finds the cheapest combination of configured daily,
  // 7-day, and 30-day packages without charging a package before its duration.
  const best = new Array<number>(days + 1).fill(Number.POSITIVE_INFINITY);
  const mode = new Array<string>(days + 1).fill('');
  best[0] = 0;

  for (let d = 1; d <= days; d += 1) {
    best[d] = best[d - 1] + daily;
    mode[d] = d === 1 ? 'Journalier' : mode[d - 1] || 'Journalier';

    if (weekly > 0 && d >= 7 && best[d - 7] + weekly < best[d]) {
      best[d] = best[d - 7] + weekly;
      mode[d] = best[d - 7] === 0 ? 'Hebdomadaire' : 'Tarif combiné';
    }

    if (monthly > 0 && d >= 30 && best[d - 30] + monthly < best[d]) {
      best[d] = best[d - 30] + monthly;
      mode[d] = best[d - 30] === 0 ? 'Mensuel' : 'Tarif combiné';
    }
  }

  const subtotalCents = Number.isFinite(best[days]) ? best[days] : 0;
  const threshold = Math.max(0, asset.discountAfterDays ?? 0);
  const configuredDiscount = Math.min(100, Math.max(0, asset.discountPercent ?? 0));
  const discountPercent =
    options.allowLongTermDiscount && threshold > 0 && days >= threshold
      ? configuredDiscount
      : 0;

  const totalCents = Math.round(subtotalCents * (1 - discountPercent / 100));
  const pricingMode = discountPercent > 0
    ? `${mode[days] || 'Journalier'} + rabais longue durée`
    : mode[days] || 'Journalier';

  return { billableDays: days, subtotalCents, totalCents, pricingMode, discountPercent };
}

export function getBlockedRange(
  start: Date,
  end: Date,
  bufferBeforeHours: number,
  bufferAfterHours: number
): { blockedStart: Date; blockedEnd: Date } {
  const before = Math.max(0, bufferBeforeHours || 0) * 60 * 60 * 1000;
  const after = Math.max(0, bufferAfterHours || 0) * 60 * 60 * 1000;

  return {
    blockedStart: new Date(start.getTime() - before),
    blockedEnd: new Date(end.getTime() + after),
  };
}

export function rangesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
}
