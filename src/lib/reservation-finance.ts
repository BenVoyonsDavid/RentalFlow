export type DepositType = 'PERCENT' | 'FIXED';
export type PaymentMode = 'NONE' | 'FULL' | 'DEPOSIT';

export interface TaxSettings {
  taxesEnabled?: boolean;
  tax1Name?: string;
  tax1Rate?: number;
  tax2Name?: string;
  tax2Rate?: number;
  tax2Compound?: boolean;
}

export interface TaxResult {
  preTaxTotalCents: number;
  tax1Cents: number;
  tax2Cents: number;
  taxTotalCents: number;
  totalCents: number;
}

export interface DepositResult {
  depositAmountCents: number;
  amountDueNowCents: number;
  balanceDueCents: number;
}

export function calculateTaxes(preTaxTotalCents: number, settings: TaxSettings): TaxResult {
  const preTax = Math.max(0, Math.round(preTaxTotalCents));
  if (settings.taxesEnabled === false) {
    return { preTaxTotalCents: preTax, tax1Cents: 0, tax2Cents: 0, taxTotalCents: 0, totalCents: preTax };
  }

  const tax1Rate = Math.max(0, Number(settings.tax1Rate) || 0);
  const tax2Rate = Math.max(0, Number(settings.tax2Rate) || 0);
  const tax1Cents = Math.round(preTax * tax1Rate / 100);
  const tax2Base = settings.tax2Compound ? preTax + tax1Cents : preTax;
  const tax2Cents = Math.round(tax2Base * tax2Rate / 100);
  const taxTotalCents = tax1Cents + tax2Cents;

  return {
    preTaxTotalCents: preTax,
    tax1Cents,
    tax2Cents,
    taxTotalCents,
    totalCents: preTax + taxTotalCents,
  };
}

export function calculateDeposit(
  totalCents: number,
  paymentMode: PaymentMode,
  depositType: DepositType,
  depositValue: number
): DepositResult {
  const total = Math.max(0, Math.round(totalCents));
  if (paymentMode === 'NONE') {
    return { depositAmountCents: 0, amountDueNowCents: 0, balanceDueCents: total };
  }
  if (paymentMode === 'FULL') {
    return { depositAmountCents: 0, amountDueNowCents: total, balanceDueCents: 0 };
  }

  const value = Math.max(0, Number(depositValue) || 0);
  const rawDeposit = depositType === 'PERCENT'
    ? Math.round(total * Math.min(value, 100) / 100)
    : Math.round(value * 100);
  const depositAmountCents = Math.min(total, rawDeposit);
  return {
    depositAmountCents,
    amountDueNowCents: depositAmountCents,
    balanceDueCents: Math.max(0, total - depositAmountCents),
  };
}

export function parseRequiredFields(csv?: string): string[] {
  return (csv || '').split(',').map((value) => value.trim()).filter(Boolean);
}

export interface ReservationRequiredData {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddressLine1?: string;
  customerCity?: string;
  customerRegion?: string;
  customerPostalCode?: string;
  customerCountry?: string;
  startDateTime?: string;
  endDateTime?: string;
  selectedAssetCount?: number;
}

export function validateRequiredFields(requiredFields: string[], data: ReservationRequiredData): string[] {
  const missing: string[] = [];
  const hasAddress = !!(
    data.customerAddressLine1?.trim() &&
    data.customerCity?.trim() &&
    data.customerRegion?.trim() &&
    data.customerPostalCode?.trim() &&
    data.customerCountry?.trim()
  );

  for (const field of new Set(requiredFields)) {
    if (field === 'CUSTOMER_NAME' && !data.customerName?.trim()) missing.push('nom du client');
    if (field === 'CUSTOMER_EMAIL' && !data.customerEmail?.trim()) missing.push('courriel du client');
    if (field === 'CUSTOMER_PHONE' && !data.customerPhone?.trim()) missing.push('téléphone du client');
    if (field === 'CUSTOMER_ADDRESS' && !hasAddress) missing.push('adresse complète du client');
    if (field === 'RENTAL_DATES' && (!data.startDateTime || !data.endDateTime)) missing.push('dates de location');
    if (field === 'EQUIPMENT' && (data.selectedAssetCount || 0) < 1) missing.push('équipement');
  }
  return missing;
}
