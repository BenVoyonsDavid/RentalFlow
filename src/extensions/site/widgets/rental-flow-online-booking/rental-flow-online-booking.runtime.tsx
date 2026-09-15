import RentalFlowBookingElement from './rental-flow-online-booking';
import { localizeDom, resolveLanguage, resolveLocale } from '../../../../intl';
import { sendRentalFlowBiEvent } from '../../../../lib/bi-events-client';
import { catalogItemAppliesToAnyAsset } from '../../../../lib/catalog-compatibility';
import {
  catalogBillableDays,
  catalogItemToReservationLine,
  computeReservationFinancials,
  type ReservationCatalogLine,
} from '../../../../lib/reservation-catalog';

// The legacy booking module still registers its constructor as
// <rental-flow-booking>. Wix CLI also registers the exported constructor using
// the extension tagName (<rental-flow-online-booking>). A Custom Element
// constructor can't be registered twice, so export a distinct subclass for Wix.
class RentalFlowOnlineBookingElement extends RentalFlowBookingElement {}

// Wix's current CLI tutorial recommends deriving the app backend origin from
// the module URL so the same endpoint URL works in local development and after
// deployment. BASE_API_URL is compiled to undefined in this custom-element
// bundle, so don't depend on it here.
const appOrigin = new URL(import.meta.url).origin;

const Element = RentalFlowOnlineBookingElement as unknown as {
  new (): HTMLElement;
  prototype: Record<string, unknown>;
};

type PublicCatalogItem = {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  itemType?: 'PRODUCT' | 'ADDON' | 'SERVICE';
  priceCents?: number;
  currency?: string;
  pricingMode?: 'FIXED' | 'PER_UNIT' | 'PER_DAY' | 'PER_RESERVATION';
  taxable?: boolean;
  required?: boolean;
  recommended?: boolean;
  trackInventory?: boolean;
  stockQuantity?: number | null;
  compatibilityMode?: 'ALL' | 'CATEGORIES' | 'TAGS' | 'ASSETS';
  applicableCategoriesJson?: string;
  applicableTagsJson?: string;
  applicableAssetIdsJson?: string;
  excludedAssetIdsJson?: string;
};

function selectionMap(instance: any): Map<string, number> {
  if (!(instance.__rentalFlowCatalogSelection instanceof Map)) {
    instance.__rentalFlowCatalogSelection = new Map<string, number>();
  }
  return instance.__rentalFlowCatalogSelection as Map<string, number>;
}

function selectedAssets(instance: any): any[] {
  const selected = instance.selected as Set<string> | undefined;
  const assets = Array.isArray(instance.data?.assets) ? instance.data.assets : [];
  if (!selected) return [];
  return assets.filter((asset: any) => selected.has(asset.id));
}

function compatibleCatalogItems(instance: any): PublicCatalogItem[] {
  const assets = selectedAssets(instance).map((asset: any) => ({
    _id: asset.id,
    productType: asset.productType || '',
    catalogTagsJson: asset.catalogTagsJson || '[]',
  }));
  if (!assets.length) return [];
  const catalog = Array.isArray(instance.data?.catalogItems) ? instance.data.catalogItems : [];
  return catalog
    .filter((item: PublicCatalogItem) => item?.id)
    .filter((item: PublicCatalogItem) => catalogItemAppliesToAnyAsset(item, assets));
}

function maxCatalogQuantity(item: PublicCatalogItem): number {
  if (item.pricingMode === 'FIXED' || item.pricingMode === 'PER_RESERVATION') return 1;
  if (item.trackInventory) return Math.max(0, Math.floor(Number(item.stockQuantity) || 0));
  return 99;
}

function syncCatalogSelections(instance: any): void {
  const map = selectionMap(instance);
  const compatible = compatibleCatalogItems(instance);
  const compatibleIds = new Set(compatible.map((item) => item.id));

  for (const id of [...map.keys()]) {
    if (!compatibleIds.has(id)) map.delete(id);
  }

  for (const item of compatible) {
    const max = maxCatalogQuantity(item);
    if (item.required) {
      map.set(item.id, max > 0 ? Math.min(Math.max(1, map.get(item.id) || 1), max) : 1);
      continue;
    }
    if (!map.has(item.id)) continue;
    if (max <= 0) map.delete(item.id);
    else map.set(item.id, Math.min(Math.max(1, map.get(item.id) || 1), max));
  }
}

function catalogBillableDaysForInstance(instance: any): number {
  const rentalDays = selectedAssets(instance).reduce(
    (max: number, asset: any) => Math.max(max, Math.floor(Number(asset.billableDays) || 0)),
    0,
  );
  if (rentalDays > 0) return rentalDays;
  return catalogBillableDays(instance.startValue, instance.endValue);
}

function selectedCatalogLines(instance: any): ReservationCatalogLine[] {
  syncCatalogSelections(instance);
  const map = selectionMap(instance);
  const days = catalogBillableDaysForInstance(instance);
  const fallbackCurrency = instance.data?.settings?.currency || 'CAD';

  return compatibleCatalogItems(instance)
    .filter((item) => map.has(item.id))
    .map((item) => catalogItemToReservationLine(
      { ...item, _id: item.id } as any,
      map.get(item.id) || 1,
      days,
      fallbackCurrency,
    ));
}

function financePreview(instance: any) {
  const rentalLines: ReservationCatalogLine[] = selectedAssets(instance).map((asset: any) => ({
    lineType: 'RENTAL',
    assetId: asset.id,
    itemName: asset.title || '',
    quantity: 1,
    taxable: true,
    billableDays: asset.billableDays || 0,
    pricingMode: asset.pricingMode || '',
    lineTotalCents: asset.lineTotalCents || 0,
    currency: asset.currency || instance.data?.settings?.currency || 'CAD',
  }));
  return computeReservationFinancials(
    [...rentalLines, ...selectedCatalogLines(instance)],
    0,
    instance.data?.settings || {},
  );
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char] || char));
}

function typeLabel(item: PublicCatalogItem, language: 'fr' | 'en'): string {
  if (item.itemType === 'PRODUCT') return language === 'fr' ? 'Produit' : 'Product';
  if (item.itemType === 'SERVICE') return 'Service';
  return 'Extra';
}

function pricingLabel(instance: any, item: PublicCatalogItem, language: 'fr' | 'en'): string {
  const money = instance.money(Math.max(0, Math.round(item.priceCents || 0)), item.currency || instance.data?.settings?.currency || 'CAD');
  if (item.pricingMode === 'PER_UNIT') return language === 'fr' ? `${money} / unité` : `${money} / unit`;
  if (item.pricingMode === 'PER_DAY') return language === 'fr' ? `${money} / jour` : `${money} / day`;
  return money;
}

function injectCatalogExtras(instance: any): boolean {
  const root = instance.shadowRoot as ShadowRoot | null;
  if (!root || instance.result) return false;

  syncCatalogSelections(instance);
  const compatible = compatibleCatalogItems(instance);
  if (!compatible.length || !selectedAssets(instance).length) return false;

  const language = resolveLanguage('site', 'auto');
  const map = selectionMap(instance);
  const lines = new Map(
    selectedCatalogLines(instance)
      .filter((line) => line.catalogItemId)
      .map((line) => [line.catalogItemId as string, line]),
  );
  const contactSection = Array.from(root.querySelectorAll<HTMLElement>('section.section'))
    .find((section) => section.querySelector('.step')?.textContent?.includes('Vos informations'));
  if (!contactSection) return false;

  const section = document.createElement('section');
  section.className = 'section rf-catalog-extras';

  const cards = compatible.map((item) => {
    const selected = map.has(item.id);
    const max = maxCatalogQuantity(item);
    const unavailable = max <= 0;
    const quantity = map.get(item.id) || 1;
    const line = lines.get(item.id);
    const showQuantity = selected && item.pricingMode !== 'FIXED' && item.pricingMode !== 'PER_RESERVATION';
    const badges = [
      item.required ? `<span class="rf-extra-badge required">${language === 'fr' ? 'Obligatoire' : 'Required'}</span>` : '',
      item.recommended ? `<span class="rf-extra-badge recommended">${language === 'fr' ? 'Recommandé' : 'Recommended'}</span>` : '',
    ].join('');
    const total = selected && line
      ? `<strong class="rf-extra-total">${escapeHtml(instance.money(line.lineTotalCents || 0, line.currency || item.currency || 'CAD'))}</strong>`
      : '';

    return `
      <div class="rf-extra ${selected ? 'selected' : ''} ${unavailable ? 'unavailable' : ''}">
        <label class="rf-extra-select">
          <input type="checkbox" data-catalog-toggle="${escapeHtml(item.id)}" ${selected ? 'checked' : ''} ${item.required || unavailable ? 'disabled' : ''}>
          <span class="rf-extra-main">
            <span class="rf-extra-title"><strong>${escapeHtml(item.name)}</strong>${badges}</span>
            ${item.description ? `<small>${escapeHtml(item.description)}</small>` : ''}
            <small>${escapeHtml(typeLabel(item, language))} · ${escapeHtml(pricingLabel(instance, item, language))}</small>
            ${unavailable ? `<small class="rf-extra-stock">${language === 'fr' ? 'Indisponible' : 'Unavailable'}</small>` : ''}
          </span>
        </label>
        <div class="rf-extra-actions">
          ${showQuantity ? `<label>${language === 'fr' ? 'Qté' : 'Qty'} <input type="number" min="1" max="${Math.max(1, max)}" value="${quantity}" data-catalog-qty="${escapeHtml(item.id)}"></label>` : ''}
          ${total}
        </div>
      </div>`;
  }).join('');

  section.innerHTML = `
    <style>
      .rf-extra-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
      .rf-extra{border:1px solid var(--border);border-radius:12px;padding:14px;background:#fff;display:flex;justify-content:space-between;gap:14px;align-items:center}
      .rf-extra.selected{border:2px solid var(--rf);background:var(--rf-soft)}
      .rf-extra.unavailable{opacity:.55}.rf-extra-select{display:flex;gap:11px;align-items:flex-start;cursor:pointer;flex:1}.rf-extra-select input{width:auto;margin-top:3px}
      .rf-extra-main{display:flex;flex-direction:column;gap:4px}.rf-extra-main small{color:var(--muted)}.rf-extra-title{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
      .rf-extra-badge{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;border-radius:999px;padding:3px 7px}.rf-extra-badge.required{background:#fee2e2;color:#991b1b}.rf-extra-badge.recommended{background:#dbeafe;color:#1d4ed8}
      .rf-extra-actions{display:flex;align-items:center;gap:10px}.rf-extra-actions label{display:flex;align-items:center;gap:5px;color:var(--muted)}.rf-extra-actions input{width:70px;padding:7px 8px}.rf-extra-total{white-space:nowrap}.rf-extra-stock{color:var(--danger)!important;font-weight:700}
      @media(max-width:720px){.rf-extra-list{grid-template-columns:1fr}.rf-extra{align-items:flex-start;flex-direction:column}.rf-extra-actions{width:100%;justify-content:space-between}}
    </style>
    <div class="step">3 · Extras</div>
    <h2>${language === 'fr' ? 'Complétez votre location' : 'Complete your rental'}</h2>
    <p class="muted" style="margin-bottom:14px">${language === 'fr' ? 'Ajoutez les produits, services ou options compatibles avec les équipements choisis.' : 'Add products, services, or options compatible with your selected equipment.'}</p>
    <div class="rf-extra-list">${cards}</div>`;

  contactSection.before(section);

  section.querySelectorAll<HTMLInputElement>('[data-catalog-toggle]').forEach((input) => {
    input.addEventListener('change', () => {
      const id = input.getAttribute('data-catalog-toggle') || '';
      if (!id) return;
      if (input.checked) map.set(id, 1);
      else map.delete(id);
      instance.result = null;
      instance.error = '';
      instance.render();
    });
  });

  section.querySelectorAll<HTMLInputElement>('[data-catalog-qty]').forEach((input) => {
    input.addEventListener('change', () => {
      const id = input.getAttribute('data-catalog-qty') || '';
      const item = compatible.find((candidate) => candidate.id === id);
      if (!id || !item) return;
      const max = Math.max(1, maxCatalogQuantity(item));
      const quantity = Math.min(max, Math.max(1, Math.floor(Number(input.value) || 1)));
      map.set(id, quantity);
      instance.result = null;
      instance.error = '';
      instance.render();
    });
  });

  return true;
}

function renumberSteps(root: ShadowRoot): void {
  const steps = Array.from(root.querySelectorAll<HTMLElement>('.step'));
  steps.forEach((step, index) => {
    const label = (step.textContent || '').replace(/^\s*\d+\s*·\s*/, '').trim();
    if (label) step.textContent = `${index + 1} · ${label}`;
  });
}

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

// Include catalog selections in the existing public-booking POST without
// duplicating the booking component's customer/payment submission flow.
const originalFetchJson = (Element.prototype as any).fetchJson;
if (typeof originalFetchJson === 'function') {
  (Element.prototype as any).fetchJson = function fetchJsonWithCatalog(url: string, options?: RequestInit) {
    let nextOptions = options;
    if (options?.method?.toUpperCase() === 'POST' && typeof options.body === 'string') {
      try {
        syncCatalogSelections(this);
        const payload = JSON.parse(options.body);
        payload.catalogItems = [...selectionMap(this).entries()].map(([id, quantity]) => ({ id, quantity }));
        nextOptions = { ...options, body: JSON.stringify(payload) };
      } catch {
        // Preserve the original request if the body cannot be parsed.
      }
    }
    return originalFetchJson.call(this, url, nextOptions);
  };
}

// Extend the existing summary/tax preview so extras are priced before the
// booking is submitted and the client sees the same total the backend validates.
(Element.prototype as any).subtotalCents = function subtotalWithCatalog(): number {
  return financePreview(this).subtotalCents;
};

(Element.prototype as any).taxPreview = function taxPreviewWithCatalog() {
  const finance = financePreview(this);
  return { tax1: finance.tax1Cents, tax2: finance.tax2Cents, total: finance.totalCents };
};

// Track the core RentalFlow success action only after the booking component has
// actually received a successful reservation result from the backend.
const originalSubmitBooking = (Element.prototype as any).submitBooking;
if (typeof originalSubmitBooking === 'function') {
  (Element.prototype as any).submitBooking = async function trackedSubmitBooking(...args: unknown[]) {
    syncCatalogSelections(this);
    const language = resolveLanguage('site', 'auto');
    const unavailableRequired = compatibleCatalogItems(this).find(
      (item) => item.required && item.trackInventory && maxCatalogQuantity(item) <= 0,
    );
    if (unavailableRequired) {
      this.error = language === 'fr'
        ? `L’extra obligatoire « ${unavailableRequired.name} » n’est plus disponible.`
        : `The required extra “${unavailableRequired.name}” is no longer available.`;
      this.render();
      return;
    }

    const previousReservationNumber = this.result?.reservationNumber || '';
    const result = await originalSubmitBooking.apply(this, args);
    const reservationNumber = this.result?.reservationNumber || '';

    if (reservationNumber && reservationNumber !== previousReservationNumber) {
      await Promise.all([
        sendRentalFlowBiEvent({
          eventName: 'PRIMARY_ACTION_PERFORMED',
          eventData: { source: 'online_booking_widget' },
        }, appOrigin),
        sendRentalFlowBiEvent({
          eventName: 'CUSTOM',
          customEventName: 'rentalflow_online_booking_created',
          eventData: { source: 'online_booking_widget' },
        }, appOrigin),
      ]);
    }

    return result;
  };
}

// Inject the Catalog & Extras step into the legacy booking component while
// preserving its proven date/equipment/customer/payment flow.
const originalRender = (Element.prototype as any).render;
if (typeof originalRender === 'function') {
  (Element.prototype as any).render = function catalogAwareRender(...args: unknown[]) {
    syncCatalogSelections(this);
    const result = originalRender.apply(this, args);
    const root = this.shadowRoot as ShadowRoot | null;
    if (root) {
      injectCatalogExtras(this);
      localizeDom(root, resolveLanguage('site', 'auto'));
      renumberSteps(root);
    }
    return result;
  };
}

export default Element;
