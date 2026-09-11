import { appInstances } from '@wix/app-management';

export type RentalFlowPlan = 'FREE' | 'STARTER' | 'BUSINESS' | 'PRO';

export type RentalFlowFeature =
  | 'WEEKLY_PRICING'
  | 'MONTHLY_PRICING'
  | 'LONG_TERM_DISCOUNT'
  | 'ADVANCED_CALENDAR_VIEWS'
  | 'CUSTOMER_DISCOUNT'
  | 'DOCUMENTS'
  | 'PAYMENTS'
  | 'SECURITY_DEPOSIT'
  | 'INSPECTIONS'
  | 'FULL_HISTORY'
  | 'UNLIMITED_ASSETS';

const planLevel: Record<RentalFlowPlan, number> = {
  FREE: 0,
  STARTER: 1,
  BUSINESS: 2,
  PRO: 3,
};

const minimumPlan: Record<RentalFlowFeature, RentalFlowPlan> = {
  WEEKLY_PRICING: 'STARTER',
  MONTHLY_PRICING: 'BUSINESS',
  LONG_TERM_DISCOUNT: 'BUSINESS',
  ADVANCED_CALENDAR_VIEWS: 'BUSINESS',
  CUSTOMER_DISCOUNT: 'BUSINESS',
  DOCUMENTS: 'STARTER',
  PAYMENTS: 'STARTER',
  SECURITY_DEPOSIT: 'STARTER',
  INSPECTIONS: 'BUSINESS',
  FULL_HISTORY: 'BUSINESS',
  UNLIMITED_ASSETS: 'PRO',
};

export const assetLimits: Record<RentalFlowPlan, number | null> = {
  FREE: 5,
  STARTER: 25,
  BUSINESS: 100,
  PRO: null,
};

export const planLabels: Record<RentalFlowPlan, string> = {
  FREE: 'Basic',
  STARTER: 'Starter',
  BUSINESS: 'Business',
  PRO: 'Pro',
};

export function hasFeature(plan: RentalFlowPlan, feature: RentalFlowFeature): boolean {
  return planLevel[plan] >= planLevel[minimumPlan[feature]];
}

export function requiredPlan(feature: RentalFlowFeature): RentalFlowPlan {
  return minimumPlan[feature];
}

export function assetLimitForPlan(plan: RentalFlowPlan): number | null {
  return assetLimits[plan];
}

export function canCreateAsset(plan: RentalFlowPlan, activeAssetCount: number): boolean {
  const limit = assetLimitForPlan(plan);
  return limit === null || activeAssetCount < limit;
}

function normalizePlanName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}

export function planFromPackageName(packageName: unknown, isFree?: boolean): RentalFlowPlan {
  if (isFree === true) return 'FREE';

  const normalized = normalizePlanName(packageName);
  if (!normalized) return isFree === false ? 'STARTER' : 'FREE';

  if (normalized.includes('PRO')) return 'PRO';
  if (normalized.includes('BUSINESS')) return 'BUSINESS';
  if (normalized.includes('STARTER')) return 'STARTER';
  if (normalized.includes('BASIC') || normalized.includes('FREE') || normalized.includes('GRATUIT')) return 'FREE';

  // A paid package unknown to this app is restricted to the lowest paid tier.
  return isFree === false ? 'STARTER' : 'FREE';
}

/**
 * Supports both current SDK response shapes (`response.data`) and older/direct
 * app instance shapes. Billing packageName is the authoritative tier when
 * multiple paid plans are configured in Wix.
 */
export function planFromAppInstanceResponse(response: unknown): RentalFlowPlan {
  const root = (response as any)?.data ?? response ?? {};
  const instance = (root as any)?.instance ?? (root as any)?.appInstance ?? root;
  const isFree = (instance as any)?.isFree ?? (root as any)?.isFree;
  const packageName =
    (instance as any)?.billing?.packageName ??
    (instance as any)?.packageName ??
    (root as any)?.billing?.packageName ??
    (root as any)?.packageName;

  return planFromPackageName(packageName, isFree);
}

/**
 * Dashboard resolver. Wix recommends getAppInstance() for pricing-plan gates.
 * On any lookup failure we fail closed to Basic rather than granting premium
 * functionality without confirming the subscription.
 */
export async function resolveDashboardPlan(): Promise<RentalFlowPlan> {
  if (import.meta.env.DEV) return 'PRO';
  try {
    const response = await appInstances.getAppInstance();
    return planFromAppInstanceResponse(response);
  } catch (error) {
    console.error('RentalFlow could not resolve the Wix pricing plan.', error);
    return 'FREE';
  }
}

/**
 * Synchronous fallback for legacy UI while pages migrate to async Wix plan
 * detection. Production always fails closed; development keeps full access.
 */
export function getCurrentPlan(): RentalFlowPlan {
  return import.meta.env.DEV ? 'PRO' : 'FREE';
}
