import type {
  AppSettings,
  Asset,
  DocumentTemplate,
  ReservationItem,
} from '../domain/types';
import { bookingImageUrl, normalizeBookingTheme } from './booking-theme';
import { publicBookingAsset } from './booking-assets';
import { publicCatalogItem, type BookingCatalogItem } from './booking-catalog';
import { requiredFieldsForDefaults } from './public-booking-config';
import { hasFeature, type RentalFlowPlan } from './plans';

export function buildPublicBookingPayload(input: {
  settings: AppSettings;
  templates: DocumentTemplate[];
  assets: Asset[];
  catalog: BookingCatalogItem[];
  plan: RentalFlowPlan;
  start?: Date;
  end?: Date;
  blockingItems?: ReservationItem[];
  catalogBlockingItems?: ReservationItem[];
}) {
  const {
    settings,
    templates,
    assets,
    catalog,
    plan,
    start,
    end,
    blockingItems = [],
    catalogBlockingItems = [],
  } = input;

  const paymentsEnabled = hasFeature(plan, 'PAYMENTS');
  const depositEnabled = paymentsEnabled
    && hasFeature(plan, 'SECURITY_DEPOSIT')
    && settings.defaultDepositEnabled === true;
  const currency = settings.currency || 'CAD';

  return {
    company: {
      name: settings.companyName || 'Location en ligne',
      logoUrl: settings.logoUrl || '',
    },
    hero: {
      title: settings.bookingHeroTitle || '',
      subtitle: settings.bookingHeroSubtitle || '',
      backgroundUrl: bookingImageUrl(settings.bookingHeroBackgroundUrl),
    },
    settings: {
      theme: normalizeBookingTheme(settings.bookingThemeJson),
      currency,
      taxesEnabled: settings.taxesEnabled !== false,
      tax1Name: settings.tax1Name || '',
      tax1Rate: settings.tax1Rate || 0,
      tax2Name: settings.tax2Name || '',
      tax2Rate: settings.tax2Rate || 0,
      tax2Compound: settings.tax2Compound === true,
      paymentsEnabled,
      depositEnabled,
      depositType: settings.defaultDepositType || 'PERCENT',
      depositValue: settings.defaultDepositValue || 0,
      requiredFields: requiredFieldsForDefaults(settings, templates),
    },
    assets: assets.map((asset) =>
      publicBookingAsset(asset, plan, start, end, settings, blockingItems)
    ),
    catalogItems: catalog.map((item) =>
      publicCatalogItem(item, currency, catalogBlockingItems)
    ),
  };
}
