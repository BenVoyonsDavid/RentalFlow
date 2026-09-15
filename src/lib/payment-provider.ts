export type PaymentProvider = 'WIX' | 'PAYFLOW_SQUARE' | 'PAYFLOW_STRIPE';
export type PaymentEnvironment = 'TEST' | 'LIVE';
export type PaymentAccountStatus = 'NOT_CONNECTED' | 'ONBOARDING' | 'RESTRICTED' | 'READY';

export type PaymentAccountSnapshot = {
  provider?: string;
  environment?: string;
  accountId?: string;
  accountStatus?: string;
  detailsSubmitted?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  requirementsCurrentlyDueJson?: string;
  requirementsPastDueJson?: string;
  requirementsPendingVerificationJson?: string;
  country?: string;
  defaultCurrency?: string;
  lastSyncedAt?: Date | string;
};

export function normalizePaymentProvider(value?: string | null): PaymentProvider {
  if (value === 'PAYFLOW_SQUARE') return 'PAYFLOW_SQUARE';
  if (value === 'PAYFLOW_STRIPE') return 'PAYFLOW_STRIPE';
  return 'WIX';
}

export function normalizePaymentEnvironment(value?: string | null): PaymentEnvironment {
  return value === 'LIVE' ? 'LIVE' : 'TEST';
}

export function decodeStringList(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function paymentAccountStatus(snapshot?: PaymentAccountSnapshot | null): PaymentAccountStatus {
  if (!snapshot || normalizePaymentProvider(snapshot.provider) === 'WIX' || !snapshot.accountId) {
    return 'NOT_CONNECTED';
  }

  if (snapshot.accountStatus === 'READY') return 'READY';
  if (snapshot.accountStatus === 'RESTRICTED') return 'RESTRICTED';
  if (snapshot.accountStatus === 'ONBOARDING') return 'ONBOARDING';

  if (snapshot.chargesEnabled === true && snapshot.detailsSubmitted === true) {
    return 'READY';
  }

  const pastDue = decodeStringList(snapshot.requirementsPastDueJson);
  if (pastDue.length > 0) return 'RESTRICTED';

  return 'ONBOARDING';
}

export function paymentAccountReady(snapshot?: PaymentAccountSnapshot | null): boolean {
  return paymentAccountStatus(snapshot) === 'READY';
}

export function maskedPaymentAccountId(value?: string | null): string {
  const id = String(value || '').trim();
  if (!id) return '—';
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}
