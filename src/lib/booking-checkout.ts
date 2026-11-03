/**
 * Payment Links originate from the Wix backend, but must still be validated
 * before interpolation into an HTML link. Merchant checkout domains can vary.
 */
export function safeBookingCheckoutUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return '';
    return url.href;
  } catch {
    return '';
  }
}
