export type PublicCustomerInput = {
  name?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
};

export type NormalizedPublicCustomer = {
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

function clean(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

export function normalizePublicCustomer(
  input: PublicCustomerInput | undefined,
): NormalizedPublicCustomer {
  return {
    name: clean(input?.name, 150),
    email: clean(input?.email, 200).toLowerCase(),
    phone: clean(input?.phone, 60),
    addressLine1: clean(input?.addressLine1, 200),
    addressLine2: clean(input?.addressLine2, 200),
    city: clean(input?.city, 120),
    region: clean(input?.region, 120),
    postalCode: clean(input?.postalCode, 30).toUpperCase(),
    country: clean(input?.country, 120) || 'Canada',
  };
}

export function validatePublicCustomer(customer: NormalizedPublicCustomer): void {
  if (!customer.name) throw new Error('CUSTOMER_NAME_REQUIRED');
  if (!customer.email || !customer.email.includes('@')) throw new Error('CUSTOMER_EMAIL_INVALID');
}
