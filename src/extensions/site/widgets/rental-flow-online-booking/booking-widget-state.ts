import type { BookingTheme } from '../../../../lib/booking-theme';

export type PublicAsset = {
  id: string;
  title: string;
  imageUrl?: string;
  productType: string;
  categoryId?: string;
  categoryName?: string;
  catalogTagsJson?: string;
  currency: string;
  dailyRateCents: number;
  weeklyRateCents: number;
  monthlyRateCents: number;
  available: boolean | null;
  billableDays: number;
  lineTotalCents: number;
  pricingMode: string;
};

export type BookingSettings = {
  theme?: BookingTheme;
  currency: string;
  taxesEnabled: boolean;
  tax1Name: string;
  tax1Rate: number;
  tax2Name: string;
  tax2Rate: number;
  tax2Compound: boolean;
  paymentsEnabled: boolean;
  depositEnabled: boolean;
  depositType: 'PERCENT' | 'FIXED';
  depositValue: number;
  requiredFields: string[];
};

export type BookingData = {
  company: { name: string; logoUrl: string };
  hero?: { title?: string; subtitle?: string; backgroundUrl?: string };
  settings: BookingSettings;
  assets: PublicAsset[];
  catalogItems?: unknown[];
};

export type BookingResult = {
  reservationNumber: string;
  totalCents: number;
  amountDueNowCents: number;
  balanceDueCents: number;
  currency: string;
  checkoutUrl: string;
};

export type CustomerDraft = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  notes: string;
};

export type BookingWidgetState = {
  data: BookingData;
  selected: Set<string>;
  customerDraft: CustomerDraft;
  calendarMonth: Date;
  choosingEnd: boolean;
  startValue: string;
  endValue: string;
  paymentMode: 'FULL' | 'DEPOSIT';
  loading: boolean;
  searching: boolean;
  submitting: boolean;
  message: string;
  error: string;
  result: BookingResult | null;
};

export const initialSettings: BookingSettings = {
  currency: 'CAD',
  taxesEnabled: true,
  tax1Name: 'TPS',
  tax1Rate: 5,
  tax2Name: 'TVQ',
  tax2Rate: 9.975,
  tax2Compound: false,
  paymentsEnabled: false,
  depositEnabled: false,
  depositType: 'PERCENT',
  depositValue: 25,
  requiredFields: [],
};

export const blankCustomerDraft: CustomerDraft = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  region: 'QC',
  postalCode: '',
  country: 'Canada',
  notes: '',
};

export function createBookingWidgetState(): BookingWidgetState {
  return {
    data: {
      company: { name: 'Location en ligne', logoUrl: '' },
      hero: { title: '', subtitle: '', backgroundUrl: '' },
      settings: { ...initialSettings },
      assets: [],
      catalogItems: [],
    },
    selected: new Set<string>(),
    customerDraft: { ...blankCustomerDraft },
    calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    choosingEnd: false,
    startValue: '',
    endValue: '',
    paymentMode: 'FULL',
    loading: true,
    searching: false,
    submitting: false,
    message: '',
    error: '',
    result: null,
  };
}
