import { appInstances } from '@wix/app-management';

export type RentalFlowPlan = 'NO_PLAN' | 'BASIC' | 'TRIAL' | 'STARTER' | 'BUSINESS' | 'PRO';

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
  NO_PLAN: -1,
  BASIC: 0,
  STARTER: 1,
  BUSINESS: 2,
  PRO: 3,
  // Wix free trial exposes the full RentalFlow experience.
  TRIAL: 3,
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
  NO_PLAN: 0,
  BASIC: 5,
  TRIAL: null,
  STARTER: 25,
  BUSINESS: 100,
  PRO: null,
};

export const planLabels: Record<RentalFlowPlan, string> = {
  NO_PLAN: 'Aucun abonnement',
  BASIC: 'Basic',
  TRIAL: 'Essai gratuit',
  STARTER: 'Starter',
  BUSINESS: 'Business',
  PRO: 'Pro',
};

let resolvedPlanCache: RentalFlowPlan | null = null;
let resolvePlanPromise: Promise<RentalFlowPlan> | null = null;

export function hasFeature(plan: RentalFlowPlan, feature: RentalFlowFeature): boolean {
  if (plan === 'NO_PLAN') return false;
  return planLevel[plan] >= planLevel[minimumPlan[feature]];
}

export function hasAppAccess(plan: RentalFlowPlan): boolean {
  return plan !== 'NO_PLAN';
}

export function isTrialPlan(plan: RentalFlowPlan): boolean {
  return plan === 'TRIAL';
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
  const normalized = normalizePlanName(packageName);

  if (
    isFree === true
    || normalized.includes('BASIC')
    || normalized.includes('FREE')
    || normalized.includes('GRATUIT')
  ) {
    return 'BASIC';
  }

  if (!normalized) return isFree === false ? 'STARTER' : 'NO_PLAN';

  if (normalized.includes('PRO') || normalized.includes('PREMIUM')) return 'PRO';
  if (normalized.includes('BUSINESS') || normalized.includes('GROWTH')) return 'BUSINESS';
  if (normalized.includes('STARTER') || normalized.includes('PLUS')) return 'STARTER';
  // Unknown paid packages fail closed to the lowest paid tier.
  return isFree === false ? 'STARTER' : 'NO_PLAN';
}

/**
 * Supports both current SDK response shapes (`response.data`) and older/direct
 * app instance shapes. Billing packageName is authoritative when multiple paid
 * plans are configured in Wix.
 */
export function planFromAppInstanceResponse(response: unknown): RentalFlowPlan {
  const root = (response as any)?.data ?? response ?? {};
  const instance = (root as any)?.instance ?? (root as any)?.appInstance ?? root;
  const isFree = (instance as any)?.isFree ?? (root as any)?.isFree;
  const billing = (instance as any)?.billing ?? (root as any)?.billing ?? {};
  const freeTrialStatus = String((billing as any)?.freeTrialInfo?.status || '').toUpperCase();
  if (freeTrialStatus === 'IN_PROGRESS') return 'TRIAL';

  // Wix development sites don't purchase App Market plans. Treat them like a
  // full-feature trial so preview/testing stays possible without creating a
  // permanent free tier for real customer sites.
  const siteUrl = String((root as any)?.site?.url || (instance as any)?.site?.url || '').toLowerCase();
  if (isFree === true && siteUrl.includes('wix-development-sites.org')) return 'TRIAL';

  const packageName =
    (billing as any)?.packageName ??
    (instance as any)?.packageName ??
    (root as any)?.packageName;

  return planFromPackageName(packageName, isFree);
}

/**
 * Resolves the installed Wix pricing plan once per page session and caches it.
 * Any lookup failure fails closed to no access rather than granting paid features.
 */
export async function resolveDashboardPlan(): Promise<RentalFlowPlan> {
  if (resolvedPlanCache) return resolvedPlanCache;
  if (resolvePlanPromise) return resolvePlanPromise;

  resolvePlanPromise = (async () => {
    try {
      const response = await appInstances.getAppInstance();
      resolvedPlanCache = planFromAppInstanceResponse(response);
    } catch (error) {
      console.error('RentalFlow could not resolve the Wix pricing plan.', error);
      resolvedPlanCache = 'NO_PLAN';
    } finally {
      resolvePlanPromise = null;
    }
    return resolvedPlanCache || 'NO_PLAN';
  })();

  return resolvePlanPromise;
}

/**
 * Synchronous compatibility accessor for legacy pages. Dashboard localization
 * resolves the plan before/while those pages render, so subsequent renders use
 * this cache. Customer sites default to no access until Wix confirms an active trial or paid package.
 */
export function getCurrentPlan(): RentalFlowPlan {
  return resolvedPlanCache || 'NO_PLAN';
}
