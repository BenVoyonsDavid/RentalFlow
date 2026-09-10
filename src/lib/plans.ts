export type RentalFlowPlan = 'FREE' | 'STARTER' | 'BUSINESS' | 'PRO';

export type RentalFlowFeature =
  | 'WEEKLY_PRICING'
  | 'MONTHLY_PRICING'
  | 'LONG_TERM_DISCOUNT'
  | 'ADVANCED_CALENDAR_VIEWS'
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
  UNLIMITED_ASSETS: 'PRO',
};

export const planLabels: Record<RentalFlowPlan, string> = {
  FREE: 'Gratuit',
  STARTER: 'Starter',
  BUSINESS: 'Business',
  PRO: 'Pro',
};

export function hasFeature(
  plan: RentalFlowPlan,
  feature: RentalFlowFeature
): boolean {
  return planLevel[plan] >= planLevel[minimumPlan[feature]];
}

export function requiredPlan(feature: RentalFlowFeature): RentalFlowPlan {
  return minimumPlan[feature];
}

/**
 * During local Wix development we intentionally expose every feature so the
 * complete product can be tested before App Market pricing is configured.
 *
 * Before public launch this function will be connected to Wix App Management
 * getAppInstance(), using isFree/packageName to resolve the installed plan.
 */
export function getCurrentPlan(): RentalFlowPlan {
  if (import.meta.env.DEV) return 'PRO';

  // Safe launch fallback until Wix pricing packages are configured.
  return 'FREE';
}
