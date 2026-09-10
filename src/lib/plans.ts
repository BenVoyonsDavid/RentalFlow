export type RentalFlowPlan = 'FREE' | 'STARTER' | 'BUSINESS' | 'PRO';

export type RentalFlowFeature =
  | 'WEEKLY_PRICING'
  | 'MONTHLY_PRICING'
  | 'LONG_TERM_DISCOUNT'
  | 'ADVANCED_CALENDAR_VIEWS'
  | 'CUSTOMER_DISCOUNT'
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
  UNLIMITED_ASSETS: 'PRO',
};

export const planLabels: Record<RentalFlowPlan, string> = {
  FREE: 'Gratuit',
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

/**
 * During local Wix development every feature is exposed so the complete
 * product can be tested before App Market pricing packages are configured.
 * Before public launch this function will resolve the real installed plan.
 */
export function getCurrentPlan(): RentalFlowPlan {
  if (import.meta.env.DEV) return 'PRO';
  return 'FREE';
}
