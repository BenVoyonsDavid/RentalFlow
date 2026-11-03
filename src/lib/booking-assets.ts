import type { AppSettings, Asset, ReservationItem } from '../domain/types';
import { bookingImageUrl } from './booking-theme';
import { isAssetAvailable } from './asset-availability';
import { calculateRentalPrice } from './rental-pricing';
import { hasFeature, type RentalFlowPlan } from './plans';

export function bookingPricingOptions(plan: RentalFlowPlan) {
  return {
    allowWeekly: hasFeature(plan, 'WEEKLY_PRICING'),
    allowMonthly: hasFeature(plan, 'MONTHLY_PRICING'),
    allowLongTermDiscount: hasFeature(plan, 'LONG_TERM_DISCOUNT'),
  };
}

export function publicBookingAsset(
  asset: Asset,
  plan: RentalFlowPlan,
  start?: Date,
  end?: Date,
  settings?: AppSettings,
  blockingItems: ReservationItem[] = [],
) {
  const before = settings?.defaultBufferBeforeHours || 0;
  const after = settings?.defaultBufferAfterHours || 0;
  let available: boolean | null = null;
  let billableDays = 0;
  let lineTotalCents = 0;
  let pricingMode = '';

  if (asset._id && start && end && settings) {
    available = isAssetAvailable(
      asset._id,
      start,
      end,
      before,
      after,
      blockingItems,
    );

    try {
      const price = calculateRentalPrice(
        asset,
        start,
        end,
        bookingPricingOptions(plan),
      );
      billableDays = price.billableDays;
      lineTotalCents = price.totalCents;
      pricingMode = price.pricingMode;
    } catch {
      available = false;
    }
  }

  return {
    id: asset._id || '',
    imageUrl: bookingImageUrl(asset.image),
    title: asset.title || 'Équipement',
    productType: asset.productType || '',
    categoryId: asset.categoryId || '',
    categoryName: asset.categoryName || '',
    catalogTagsJson: asset.catalogTagsJson || '[]',
    currency: asset.currency || settings?.currency || 'CAD',
    dailyRateCents: asset.dailyRateCents || 0,
    weeklyRateCents: hasFeature(plan, 'WEEKLY_PRICING')
      ? asset.weeklyRateCents || 0
      : 0,
    monthlyRateCents: hasFeature(plan, 'MONTHLY_PRICING')
      ? asset.monthlyRateCents || 0
      : 0,
    available,
    billableDays,
    lineTotalCents,
    pricingMode,
  };
}
