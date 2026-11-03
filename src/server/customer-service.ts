import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import type { Customer } from '../domain/types';
import type { NormalizedPublicCustomer } from '../lib/booking-customer';
import { COLLECTIONS } from '../lib/collection-ids';
import { generateReferenceNumber } from '../lib/reference-number';

const CUSTOMERS = COLLECTIONS.customers;

function elevatedQuery(collectionId: string): any {
  const query = auth.elevate(items.query);
  return query(collectionId);
}

async function elevatedFind(query: any): Promise<any> {
  return query.find({ consistentRead: true });
}

async function elevatedInsert(collectionId: string, item: Record<string, unknown>): Promise<any> {
  const insert = auth.elevate(items.insert);
  return insert(collectionId, item);
}

export async function findCustomerByEmail(email: string): Promise<Customer | undefined> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return undefined;

  const result = await elevatedFind(
    elevatedQuery(CUSTOMERS).eq('email', normalized).limit(1),
  );
  return result.items?.[0] as Customer | undefined;
}

export async function findOrCreatePublicCustomer(
  customer: NormalizedPublicCustomer,
): Promise<Customer> {
  const existing = await findCustomerByEmail(customer.email);
  if (existing?._id) return existing;

  return await elevatedInsert(CUSTOMERS, {
    customerNumber: generateReferenceNumber('C'),
    firstName: customer.name,
    lastName: '',
    companyName: '',
    email: customer.email,
    phone: customer.phone,
    addressLine1: customer.addressLine1,
    addressLine2: customer.addressLine2,
    city: customer.city,
    region: customer.region,
    postalCode: customer.postalCode,
    country: customer.country,
    discountPercent: 0,
    active: true,
  }) as Customer;
}
