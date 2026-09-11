import RentalFlowBookingElement from './rental-flow-online-booking';
import { localizeDom, resolveLanguage, resolveLocale } from '../../../../intl';

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

// The public widget follows the site's active Wix language automatically.
// Keep currency formatting aligned with Wix's locale as well.
(Element.prototype as any).money = function money(cents = 0, currency = 'CAD'): string {
  return new Intl.NumberFormat(resolveLocale('site', 'auto'), { style: 'currency', currency }).format(cents / 100);
};

// The existing booking component predates RentalFlow's i18n layer and contains
// French source strings. Localize its Shadow DOM immediately after each render
// so existing screens become bilingual without duplicating the booking logic.
const originalRender = (Element.prototype as any).render;
if (typeof originalRender === 'function') {
  (Element.prototype as any).render = function localizedRender(...args: unknown[]) {
    const result = originalRender.apply(this, args);
    const root = this.shadowRoot as ShadowRoot | null;
    if (root) localizeDom(root, resolveLanguage('site', 'auto'));
    return result;
  };
}

export default Element;
