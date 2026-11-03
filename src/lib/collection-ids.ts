/**
 * Canonical Wix Data collection IDs used by RentalFlow.
 * Keep collection identifiers in one place so dashboard pages and HTTP endpoints
 * cannot silently drift apart.
 */
export const COLLECTIONS = {
  activityLog: '@pilotedavid1/rental-flow/activity-log',
  appSettings: '@pilotedavid1/rental-flow/app-settings',
  assets: '@pilotedavid1/rental-flow/assets',
  assetCapacityLocks: '@pilotedavid1/rental-flow/asset-capacity-locks',
  bookingLocks: '@pilotedavid1/rental-flow/booking-locks',
  catalogItems: '@pilotedavid1/rental-flow/catalog-items',
  catalogStockLocks: '@pilotedavid1/rental-flow/catalog-stock-locks',
  categories: '@pilotedavid1/rental-flow/categories',
  customers: '@pilotedavid1/rental-flow/customers',
  documentTemplates: '@pilotedavid1/rental-flow/document-templates',
  documents: '@pilotedavid1/rental-flow/documents',
  inspections: '@pilotedavid1/rental-flow/inspections',
  paymentAccounts: '@pilotedavid1/rental-flow/payment-accounts',
  payments: '@pilotedavid1/rental-flow/payments',
  reservationItems: '@pilotedavid1/rental-flow/reservation-items',
  reservations: '@pilotedavid1/rental-flow/reservations',
} as const;

export type RentalFlowCollectionId = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
