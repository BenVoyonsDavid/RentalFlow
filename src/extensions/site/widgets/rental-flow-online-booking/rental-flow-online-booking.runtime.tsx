import RentalFlowBookingElement from './rental-flow-online-booking';

// Wix's current CLI tutorial recommends deriving the app backend origin from
// the module URL so the same endpoint URL works in local development and after
// deployment. BASE_API_URL is compiled to undefined in this custom-element
// bundle, so don't depend on it here.
const appOrigin = new URL(import.meta.url).origin;

const Element = RentalFlowBookingElement as unknown as {
  new (): HTMLElement;
  prototype: Record<string, unknown>;
};

// apiUrl is private only at TypeScript compile time. Patch the booking element
// before Wix registers it so all GET/POST booking calls use the Wix-managed app
// origin without hardcoding a development or deployment host.
(Element.prototype as any).apiUrl = function apiUrl(params = ''): string {
  const url = `${appOrigin}/api/public-booking`;
  return params ? `${url}?${params}` : url;
};

export default Element;
