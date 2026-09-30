import { bookingThemeVariables, bookingImageUrl } from '../../../../lib/booking-theme';
import { resolveLanguage } from '../../../../intl';
import designStyles from './booking-design.css?inline';
import { fetchPublicBookingJson, publicBookingApiUrl } from './booking-widget-api';
import {
  createBookingWidgetState,
  type BookingData,
  type BookingResult,
  type CustomerDraft,
  type PublicAsset,
} from './booking-widget-state';
import {
  escapeBookingHtml,
  renderBookingAssetCards,
  renderBookingCalendar,
} from './booking-widget-view';

export class RentalFlowBookingElement extends HTMLElement {
  protected root: ShadowRoot;
  protected readonly state = createBookingWidgetState();

  protected get data(): BookingData {
    return this.state.data;
  }

  protected set data(value: BookingData) {
    this.state.data = value;
  }

  protected get selected(): Set<string> {
    return this.state.selected;
  }

  protected get customerDraft(): CustomerDraft {
    return this.state.customerDraft;
  }

  protected set customerDraft(value: CustomerDraft) {
    this.state.customerDraft = value;
  }

  protected get calendarMonth(): Date {
    return this.state.calendarMonth;
  }

  protected set calendarMonth(value: Date) {
    this.state.calendarMonth = value;
  }

  protected get choosingEnd(): boolean {
    return this.state.choosingEnd;
  }

  protected set choosingEnd(value: boolean) {
    this.state.choosingEnd = value;
  }

  protected get startValue(): string {
    return this.state.startValue;
  }

  protected set startValue(value: string) {
    this.state.startValue = value;
  }

  protected get endValue(): string {
    return this.state.endValue;
  }

  protected set endValue(value: string) {
    this.state.endValue = value;
  }

  protected get paymentMode(): 'FULL' | 'DEPOSIT' {
    return this.state.paymentMode;
  }

  protected set paymentMode(value: 'FULL' | 'DEPOSIT') {
    this.state.paymentMode = value;
  }

  protected get loading(): boolean {
    return this.state.loading;
  }

  protected set loading(value: boolean) {
    this.state.loading = value;
  }

  protected get searching(): boolean {
    return this.state.searching;
  }

  protected set searching(value: boolean) {
    this.state.searching = value;
  }

  protected get submitting(): boolean {
    return this.state.submitting;
  }

  protected set submitting(value: boolean) {
    this.state.submitting = value;
  }

  protected get message(): string {
    return this.state.message;
  }

  protected set message(value: string) {
    this.state.message = value;
  }

  protected get error(): string {
    return this.state.error;
  }

  protected set error(value: string) {
    this.state.error = value;
  }

  protected get result(): BookingResult | null {
    return this.state.result;
  }

  protected set result(value: BookingResult | null) {
    this.state.result = value;
  }

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    void this.loadCatalog();
  }

  protected apiUrl(params = ''): string {
    return publicBookingApiUrl(params);
  }

  protected async fetchJson(
    url: string,
    options?: RequestInit,
  ): Promise<any> {
    return fetchPublicBookingJson(url, options);
  }

  protected async loadCatalog() {
    this.loading = true;
    this.error = '';
    this.render();
    try {
      this.data = await this.fetchJson(this.apiUrl());
      this.paymentMode = this.data.settings.depositEnabled ? 'DEPOSIT' : 'FULL';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Impossible de charger les équipements.';
    } finally {
      this.loading = false;
      this.render();
    }
  }

  protected async searchAvailability() {
    if (!this.startValue || !this.endValue) {
      this.error = 'Choisissez une date de début et une date de fin.';
      this.render();
      return;
    }

    const start = new Date(this.startValue);
    const end = new Date(this.endValue);
    if (!start.getTime() || !end.getTime() || end <= start) {
      this.error = 'La période sélectionnée est invalide.';
      this.render();
      return;
    }

    this.searching = true;
    this.error = '';
    this.message = '';
    this.selected.clear();
    this.result = null;
    this.render();

    try {
      const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
      this.data = await this.fetchJson(this.apiUrl(params.toString()));
      const availableCount = this.data.assets.filter((asset) => asset.available).length;
      this.message = availableCount
        ? `${availableCount} équipement${availableCount > 1 ? 's' : ''} disponible${availableCount > 1 ? 's' : ''}.`
        : 'Aucun équipement disponible pour cette période.';
    } catch (error) {
      this.error = this.friendlyError(error);
    } finally {
      this.searching = false;
      this.render();
    }
  }

  protected friendlyError(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error || '');
    if (raw === 'PAST_PERIOD') return 'La période choisie est déjà terminée.';
    if (raw === 'PERIOD_TOO_LONG') return 'La réservation ne peut pas dépasser 366 jours.';
    if (raw === 'INVALID_PERIOD') return 'La période sélectionnée est invalide.';
    return raw || 'Une erreur est survenue.';
  }

  protected toggleAsset(id: string) {
    const asset = this.data.assets.find((item) => item.id === id);
    if (!asset?.available) return;
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
    this.result = null;
    this.error = '';
    this.render();
  }

  protected selectedAssets(): PublicAsset[] {
    return this.data.assets.filter((asset) => this.selected.has(asset.id));
  }

  protected subtotalCents(): number {
    return this.selectedAssets().reduce((sum, asset) => sum + (asset.lineTotalCents || 0), 0);
  }

  protected taxPreview() {
    const subtotal = this.subtotalCents();
    if (!this.data.settings.taxesEnabled) return { tax1: 0, tax2: 0, total: subtotal };
    const tax1 = Math.round(subtotal * (this.data.settings.tax1Rate || 0) / 100);
    const tax2Base = this.data.settings.tax2Compound ? subtotal + tax1 : subtotal;
    const tax2 = Math.round(tax2Base * (this.data.settings.tax2Rate || 0) / 100);
    return { tax1, tax2, total: subtotal + tax1 + tax2 };
  }

  protected dueNowCents(): number {
    if (!this.data.settings.paymentsEnabled) return 0;
    const total = this.taxPreview().total;
    if (this.paymentMode !== 'DEPOSIT' || !this.data.settings.depositEnabled) return total;
    const value = this.data.settings.depositValue || 0;
    if (this.data.settings.depositType === 'FIXED') return Math.min(total, Math.round(value * 100));
    return Math.min(total, Math.round(total * value / 100));
  }

  protected isRequired(key: string): boolean {
    return this.data.settings.requiredFields.includes(key);
  }

  protected async submitBooking() {
    if (this.submitting || this.searching) return;
    if (!this.startValue || !this.endValue || this.selected.size === 0) {
      this.error = 'Choisissez une période et au moins un équipement.';
      this.render();
      return;
    }

    const customer = {
      name: this.customerDraft.customerName.trim(),
      email: this.customerDraft.customerEmail.trim(),
      phone: this.customerDraft.customerPhone.trim(),
      addressLine1: this.customerDraft.addressLine1.trim(),
      addressLine2: this.customerDraft.addressLine2.trim(),
      city: this.customerDraft.city.trim(),
      region: this.customerDraft.region.trim(),
      postalCode: this.customerDraft.postalCode.trim(),
      country: this.customerDraft.country.trim() || 'Canada',
    };

    if (!customer.name || !customer.email) {
      this.error = 'Le nom et le courriel sont obligatoires.';
      this.render();
      return;
    }

    this.submitting = true;
    this.error = '';
    this.message = '';
    this.result = null;
    this.render();

    try {
      const payload = {
        startDateTime: new Date(this.startValue).toISOString(),
        endDateTime: new Date(this.endValue).toISOString(),
        assetIds: [...this.selected],
        paymentMode: this.data.settings.paymentsEnabled ? this.paymentMode : undefined,
        customer,
        notes: this.customerDraft.notes.trim(),
      };

      this.result = await this.fetchJson(this.apiUrl(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      this.message = `Réservation ${this.result?.reservationNumber || ''} créée avec succès.`;
    } catch (error) {
      this.error = this.friendlyError(error);
      if (this.error.toLowerCase().includes('disponible')) {
        void this.searchAvailability();
        return;
      }
    } finally {
      this.submitting = false;
      this.render();
    }
  }

  protected money(cents = 0, currency = this.data.settings.currency || 'CAD'): string {
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency }).format(cents / 100);
  }

  protected escape(value: unknown): string {
    return escapeBookingHtml(value);
  }

  protected invalidateDates() {
    this.selected.clear();
    this.data.assets.forEach(asset => { asset.available = null; });
    this.result = null;
    this.message = '';
    this.error = '';
    this.render();
  }

  protected calendar(): string {
    return renderBookingCalendar({
      calendarMonth: this.calendarMonth,
      startValue: this.startValue,
      endValue: this.endValue,
      searching: this.searching,
      submitting: this.submitting,
    });
  }

  protected render() {
    const language = resolveLanguage('site', 'auto');
    const company = this.data.company;
    const hero = this.data.hero || {};
    const heroTitle = String(hero.title || '').trim();
    const heroSubtitle = String(hero.subtitle || '').trim();
    const heroBackgroundUrl = bookingImageUrl(hero.backgroundUrl);
    const defaultHeroSubtitle = this.data.settings.paymentsEnabled
      ? 'Choisissez vos dates, vos équipements et payez de façon sécurisée avec Wix.'
      : 'Choisissez vos dates et vos équipements pour créer votre réservation.';
    const heroStyle = heroBackgroundUrl
      ? ` style="background-image:linear-gradient(180deg,rgba(8,23,43,.24),rgba(8,23,43,.48)),url('${this.escape(heroBackgroundUrl)}');background-size:cover;background-position:center"`
      : '';
    const assets = this.data.assets;
    const searched = assets.some((asset) => asset.available !== null);
    const selectedAssets = this.selectedAssets();
    const subtotal = this.subtotalCents();
    const taxes = this.taxPreview();
    const dueNow = this.dueNowCents();
    const balance = Math.max(0, taxes.total - dueNow);
    const paymentsEnabled = this.data.settings.paymentsEnabled;

    const assetCards = renderBookingAssetCards({
      assets,
      selected: this.selected,
      searched,
      submitting: this.submitting,
      language,
      money: (cents, currency) => this.money(cents, currency),
    });

    const requiredAddress = this.isRequired('CUSTOMER_ADDRESS');
    const requiredPhone = this.isRequired('CUSTOMER_PHONE');

    this.root.innerHTML = `
      <style>${designStyles}
        :host{${Object.entries(bookingThemeVariables(this.data.settings.theme)).map(([key,value]) => `${key}:${value}`).join(';')}}
      </style>
      <div class="wrap">
        <header class="booking-hero"${heroStyle}>
          <div class="hero-inner">
            <div class="hero-logo">
              ${bookingImageUrl(company.logoUrl)
                ? `<img src="${this.escape(bookingImageUrl(company.logoUrl))}" alt="">`
                : '<span class="hero-logo-fallback" aria-hidden="true">R</span>'}
            </div>
            <div class="hero-copy">
              <p class="brand" translate="no">${this.escape(company.name || 'Réservation en ligne')}</p>
              <h1${heroTitle ? ' translate="no"' : ''}>${this.escape(heroTitle || 'Planifiez votre location')}</h1>
              <p class="muted"${heroSubtitle ? ' translate="no"' : ''}>${this.escape(heroSubtitle || defaultHeroSubtitle)}</p>
            </div>
          </div>
        </header>
        <main>
          ${this.error ? `<div class="notice error" role="alert">${this.escape(this.error)}</div>` : ''}
          ${this.message ? `<div class="notice success" role="status">${this.escape(this.message)}</div>` : ''}

          ${this.loading ? '<div class="loading">Chargement de la disponibilité…</div>' : this.result ? `
            <div class="complete">
              <h2>Votre réservation est créée</h2>
              <div class="number">${this.escape(this.result.reservationNumber)}</div>
              <p>Total : <strong>${this.money(this.result.totalCents, this.result.currency)}</strong></p>
              ${this.result.amountDueNowCents > 0 ? `<p style="margin-top:7px">À payer maintenant : <strong>${this.money(this.result.amountDueNowCents, this.result.currency)}</strong></p>` : ''}
              ${this.result.balanceDueCents > 0 ? `<p class="muted" style="margin-top:5px">Solde restant : ${this.money(this.result.balanceDueCents, this.result.currency)}</p>` : ''}
              ${this.result.checkoutUrl ? `<a class="button" style="display:inline-block;text-decoration:none;margin-top:18px" href="${this.escape(this.result.checkoutUrl)}">Payer avec Wix</a>` : '<p style="margin-top:14px">Aucun paiement en ligne immédiat requis.</p>'}
            </div>` : `
            <nav data-rf-step-navigation aria-label="Réservation"><span>1 · Dates et équipements</span><span>2 · Coordonnées</span><span>3 · Confirmation</span></nav>
            <div class="booking-layout">
            <section class="section dates-panel">
              <div class="step">1 · Dates</div><h2>Sélectionnez vos dates</h2>
              ${this.calendar()}<div class="search-row">
                <div class="field"><label for="start">Début</label><input ${this.searching || this.submitting ? 'disabled' : ''} id="start" type="datetime-local" value="${this.escape(this.startValue)}"></div>
                <div class="field"><label for="end">Fin</label><input ${this.searching || this.submitting ? 'disabled' : ''} id="end" type="datetime-local" value="${this.escape(this.endValue)}"></div>
                <button id="search" class="button" ${this.searching || this.submitting ? 'disabled' : ''}>${this.searching ? 'Recherche…' : 'Voir les disponibilités'}</button>
              </div>
            </section>
            <div class="booking-content"><section class="section equipment-panel">
              <div class="step">2 · Équipements</div><h2>${searched ? 'Équipements disponibles' : 'Nos équipements'}</h2>
              ${assets.length ? `<div class="assets">${assetCards}</div>` : '<p class="muted">Aucun équipement actif pour le moment.</p>'}
            </section>
            <div data-rf-extras></div>
            ${selectedAssets.length ? `
              <section class="section contact-panel" data-rf-contact-section>
                <div class="step">3 · Vos informations</div><h2>Coordonnées</h2>
                <form id="customer-form" class="grid">
                  <div class="field"><label for="rf-customerName">Nom complet *</label><input id="rf-customerName" name="customerName" required autocomplete="name" value="${this.escape(this.customerDraft.customerName)}"></div>
                  <div class="field"><label for="rf-customerEmail">Courriel *</label><input id="rf-customerEmail" name="customerEmail" required type="email" autocomplete="email" value="${this.escape(this.customerDraft.customerEmail)}"></div>
                  <div class="field"><label for="rf-customerPhone">Téléphone ${requiredPhone ? '*' : ''}</label><input id="rf-customerPhone" name="customerPhone" ${requiredPhone ? 'required' : ''} autocomplete="tel" value="${this.escape(this.customerDraft.customerPhone)}"></div>
                  <div class="field"><label for="rf-addressLine1">Adresse ${requiredAddress ? '*' : ''}</label><input id="rf-addressLine1" name="addressLine1" ${requiredAddress ? 'required' : ''} autocomplete="street-address" value="${this.escape(this.customerDraft.addressLine1)}"></div>
                  <div class="field"><label for="rf-addressLine2">Adresse 2</label><input id="rf-addressLine2" name="addressLine2" value="${this.escape(this.customerDraft.addressLine2)}"></div>
                  <div class="field"><label for="rf-city">Ville ${requiredAddress ? '*' : ''}</label><input id="rf-city" name="city" ${requiredAddress ? 'required' : ''} autocomplete="address-level2" value="${this.escape(this.customerDraft.city)}"></div>
                  <div class="field"><label for="rf-region">Province / État ${requiredAddress ? '*' : ''}</label><input id="rf-region" name="region" ${requiredAddress ? 'required' : ''} autocomplete="address-level1" value="${this.escape(this.customerDraft.region)}"></div>
                  <div class="field"><label for="rf-postalCode">Code postal ${requiredAddress ? '*' : ''}</label><input id="rf-postalCode" name="postalCode" ${requiredAddress ? 'required' : ''} autocomplete="postal-code" value="${this.escape(this.customerDraft.postalCode)}"></div>
                  <div class="field"><label for="rf-country">Pays ${requiredAddress ? '*' : ''}</label><input id="rf-country" name="country" ${requiredAddress ? 'required' : ''} autocomplete="country-name" value="${this.escape(this.customerDraft.country)}"></div>
                  <div class="field full"><label for="rf-notes">Notes</label><textarea id="rf-notes" name="notes" placeholder="Information utile concernant votre réservation">${this.escape(this.customerDraft.notes)}</textarea></div>
                </form>
              </section>` : ''}
            </div>
              <section class="section summary-panel">
                <div class="step">4 · ${paymentsEnabled ? 'Paiement' : 'Confirmation'}</div><h2>Votre réservation</h2>
                ${selectedAssets.length ? selectedAssets.map(asset => `<div class="summary-item"><strong translate="no">${this.escape(asset.title)}</strong><span>${this.money(asset.lineTotalCents,asset.currency)}</span></div>`).join('') : '<p class="empty-summary">Choisissez vos dates et vos équipements pour commencer.</p>'}
                <div data-rf-summary-extras></div>
                ${selectedAssets.length ? '<button class="button secondary" id="continue">Continuer vers les coordonnées</button>' : ''}
                ${paymentsEnabled && this.data.settings.depositEnabled ? `<div class="payment-options">
                  <label class="choice ${this.paymentMode === 'DEPOSIT' ? 'active' : ''}"><input type="radio" ${this.submitting ? 'disabled' : ''} name="paymentMode" value="DEPOSIT" ${this.paymentMode === 'DEPOSIT' ? 'checked' : ''}> Payer le dépôt (${this.data.settings.depositType === 'PERCENT' ? `${this.data.settings.depositValue}%` : this.money(Math.round(this.data.settings.depositValue * 100))})</label>
                  <label class="choice ${this.paymentMode === 'FULL' ? 'active' : ''}"><input type="radio" ${this.submitting ? 'disabled' : ''} name="paymentMode" value="FULL" ${this.paymentMode === 'FULL' ? 'checked' : ''}> Payer en totalité</label>
                </div>` : ''}
                <div class="summary">
                  <div class="sumrow"><span>Sous-total</span><strong>${this.money(subtotal)}</strong></div>
                  ${this.data.settings.taxesEnabled ? `<div class="sumrow"><span>${this.escape(this.data.settings.tax1Name || 'Taxe 1')}</span><span>${this.money(taxes.tax1)}</span></div><div class="sumrow"><span>${this.escape(this.data.settings.tax2Name || 'Taxe 2')}</span><span>${this.money(taxes.tax2)}</span></div>` : ''}
                  <div class="sumrow total"><span>Total</span><span>${this.money(taxes.total)}</span></div>
                  ${paymentsEnabled ? `<div class="sumrow due"><span>À payer maintenant</span><span>${this.money(dueNow)}</span></div>` : ''}
                  ${balance > 0 ? `<div class="sumrow"><span>Solde restant</span><span>${this.money(balance)}</span></div>` : ''}
                </div>
                <button id="submit" class="button" style="width:100%;margin-top:14px;padding:14px" ${this.submitting || !selectedAssets.length ? 'disabled' : ''}>${this.submitting ? 'Création de la réservation…' : paymentsEnabled ? 'Réserver et continuer au paiement' : 'Créer la réservation'}</button>
              <p class="payment-note">${paymentsEnabled ? 'Paiement sécurisé avec Wix.' : 'Paiement selon les modalités du locateur.'}</p></section>
            </div>
          `}
        </main>
      </div>`;

    this.bindEvents();
  }

  protected bindEvents() {
    this.root.querySelectorAll<HTMLElement>('[data-month]').forEach(button => button.addEventListener('click', () => {
      this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + Number(button.dataset.month),1);
      this.render();
      this.root.querySelector<HTMLButtonElement>(`[data-month="${button.dataset.month}"]`)?.focus();
    }));
    this.root.querySelectorAll<HTMLElement>('[data-day]').forEach(button => button.addEventListener('click', () => {
      const day = button.dataset.day!;
      if (!this.choosingEnd || day < this.startValue.slice(0,10)) {
        this.startValue = `${day}T${this.startValue.slice(11) || '09:00'}`;
        this.endValue = '';
        this.choosingEnd = true;
      } else {
        this.endValue = `${day}T17:00`;
        this.choosingEnd = false;
      }
      this.invalidateDates();
      this.root.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)?.focus();
    }));
    this.root.querySelector('#continue')?.addEventListener('click', () => {
      this.root.querySelector('[data-rf-contact-section]')?.scrollIntoView({behavior:'smooth',block:'start'});
      this.root.querySelector<HTMLInputElement>('[name="customerName"]')?.focus({preventScroll:true});
    });
    this.root.querySelector('#customer-form')?.addEventListener('submit', event => { event.preventDefault(); void this.submitBooking(); });
    const start = this.root.querySelector<HTMLInputElement>('#start');
    const end = this.root.querySelector<HTMLInputElement>('#end');
    start?.addEventListener('change', () => { this.startValue = start.value; if (start.value) this.calendarMonth = new Date(new Date(start.value).getFullYear(),new Date(start.value).getMonth(),1); this.invalidateDates(); });
    end?.addEventListener('change', () => { this.endValue = end.value; this.invalidateDates(); });
    this.root.querySelector('#search')?.addEventListener('click', (event) => {
      event.preventDefault();
      this.startValue = start?.value || this.startValue;
      this.endValue = end?.value || this.endValue;
      void this.searchAvailability();
    });

    this.root.querySelectorAll<HTMLElement>('[data-asset]').forEach((element) => {
      element.addEventListener('click', (event) => {
        event.preventDefault();
        const id = element.getAttribute('data-asset');
        if (id) this.toggleAsset(id);
      });
    });

    this.root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[name]').forEach((field) => {
      const name = field.getAttribute('name') as keyof CustomerDraft | null;
      if (!name || name === ('paymentMode' as keyof CustomerDraft)) return;
      if (name in this.customerDraft) {
        field.addEventListener('input', () => {
          this.customerDraft = { ...this.customerDraft, [name]: field.value };
        });
      }
    });

    this.root.querySelectorAll<HTMLInputElement>('input[name="paymentMode"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        if (radio.checked && (radio.value === 'FULL' || radio.value === 'DEPOSIT')) {
          this.paymentMode = radio.value;
          this.render();
        }
      });
    });

    this.root.querySelector('#submit')?.addEventListener('click', (event) => {
      event.preventDefault();
      if (this.root.querySelector<HTMLFormElement>('#customer-form')?.reportValidity()) void this.submitBooking();
    });
  }
}

export default RentalFlowBookingElement;
