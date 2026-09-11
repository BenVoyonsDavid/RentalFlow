import RentalFlowBookingElement from './rental-flow-online-booking';

// Wix normally injects BASE_API_URL into site-extension bundles. In this app the
// value is currently missing in the Site Widget runtime, so requests fall back
// to the app's own Wix-hosted origin. The app ID is public and the wix.run
// origin is the app's Wix-managed hosting origin.
const APP_HOST = 'https://8ee574c2-70b9-45e9-98ed-9e8439a26e5d.wix.run';

const configuredBase = String(import.meta.env.BASE_API_URL || '').trim().replace(/\/$/, '');
const effectiveBase = configuredBase || APP_HOST;

const Element = RentalFlowBookingElement as unknown as {
  new (): HTMLElement;
  prototype: Record<string, unknown>;
};

// apiUrl is private only at TypeScript compile time. Patch the generated
// custom-element class before Wix registers it so the rest of the booking UI
// can stay unchanged while the CLI BASE_API_URL issue is isolated.
(Element.prototype as any).apiUrl = function apiUrl(params = ''): string {
  const url = `${effectiveBase}/api/public-booking`;
  return params ? `${url}?${params}` : url;
};

export default Element;
