import { httpClient } from '@wix/essentials';

type PublicAsset = {
  id: string;
  title: string;
  productType: string;
  currency: string;
  dailyRateCents: number;
  weeklyRateCents: number;
  monthlyRateCents: number;
  available: boolean | null;
  billableDays: number;
  lineTotalCents: number;
  pricingMode: string;
};

type BookingSettings = {
  currency: string;
  taxesEnabled: boolean;
  tax1Name: string;
  tax1Rate: number;
  tax2Name: string;
  tax2Rate: number;
  tax2Compound: boolean;
  paymentsEnabled: boolean;
  depositEnabled: boolean;
  depositType: 'PERCENT' | 'FIXED';
  depositValue: number;
  requiredFields: string[];
};

type BookingData = {
  company: { name: string; logoUrl: string };
  settings: BookingSettings;
  assets: PublicAsset[];
};

type BookingResult = {
  reservationNumber: string;
  totalCents: number;
  amountDueNowCents: number;
  balanceDueCents: number;
  currency: string;
  checkoutUrl: string;
};

type CustomerDraft = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  notes: string;
};

const initialSettings: BookingSettings = {
  currency: 'CAD',
  taxesEnabled: true,
  tax1Name: 'TPS',
  tax1Rate: 5,
  tax2Name: 'TVQ',
  tax2Rate: 9.975,
  tax2Compound: false,
  paymentsEnabled: false,
  depositEnabled: false,
  depositType: 'PERCENT',
  depositValue: 25,
  requiredFields: [],
};

const blankCustomerDraft: CustomerDraft = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  region: 'QC',
  postalCode: '',
  country: 'Canada',
  notes: '',
};

class RentalFlowBookingElement extends HTMLElement {
  private root: ShadowRoot;
  private data: BookingData = { company: { name: 'Location en ligne', logoUrl: '' }, settings: initialSettings, assets: [] };
  private selected = new Set<string>();
  private customerDraft: CustomerDraft = { ...blankCustomerDraft };
  private startValue = '';
  private endValue = '';
  private paymentMode: 'FULL' | 'DEPOSIT' = 'FULL';
  private loading = true;
  private searching = false;
  private submitting = false;
  private message = '';
  private error = '';
  private result: BookingResult | null = null;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    void this.loadCatalog();
  }

  private apiUrl(params = ''): string {
    const base = `${import.meta.env.BASE_API_URL}/api/public-booking`;
    return params ? `${base}?${params}` : base;
  }

  private async fetchJson(url: string, options?: RequestInit): Promise<any> {
    const response = await httpClient.fetchWithAuth(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || `Erreur ${response.status}`);
    return payload;
  }

  private async loadCatalog() {
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

  private async searchAvailability() {
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

  private friendlyError(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error || '');
    if (raw === 'PAST_PERIOD') return 'La période choisie est déjà terminée.';
    if (raw === 'PERIOD_TOO_LONG') return 'La réservation ne peut pas dépasser 366 jours.';
    if (raw === 'INVALID_PERIOD') return 'La période sélectionnée est invalide.';
    return raw || 'Une erreur est survenue.';
  }

  private toggleAsset(id: string) {
    const asset = this.data.assets.find((item) => item.id === id);
    if (!asset?.available) return;
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
    this.result = null;
    this.error = '';
    this.render();
  }

  private selectedAssets(): PublicAsset[] {
    return this.data.assets.filter((asset) => this.selected.has(asset.id));
  }

  private subtotalCents(): number {
    return this.selectedAssets().reduce((sum, asset) => sum + (asset.lineTotalCents || 0), 0);
  }

  private taxPreview() {
    const subtotal = this.subtotalCents();
    if (!this.data.settings.taxesEnabled) return { tax1: 0, tax2: 0, total: subtotal };
    const tax1 = Math.round(subtotal * (this.data.settings.tax1Rate || 0) / 100);
    const tax2Base = this.data.settings.tax2Compound ? subtotal + tax1 : subtotal;
    const tax2 = Math.round(tax2Base * (this.data.settings.tax2Rate || 0) / 100);
    return { tax1, tax2, total: subtotal + tax1 + tax2 };
  }

  private dueNowCents(): number {
    if (!this.data.settings.paymentsEnabled) return 0;
    const total = this.taxPreview().total;
    if (this.paymentMode !== 'DEPOSIT' || !this.data.settings.depositEnabled) return total;
    const value = this.data.settings.depositValue || 0;
    if (this.data.settings.depositType === 'FIXED') return Math.min(total, Math.round(value * 100));
    return Math.min(total, Math.round(total * value / 100));
  }

  private isRequired(key: string): boolean {
    return this.data.settings.requiredFields.includes(key);
  }

  private async submitBooking() {
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

  private money(cents = 0, currency = this.data.settings.currency || 'CAD'): string {
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency }).format(cents / 100);
  }

  private escape(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char] || char));
  }

  private render() {
    const company = this.data.company;
    const assets = this.data.assets;
    const searched = assets.some((asset) => asset.available !== null);
    const selectedAssets = this.selectedAssets();
    const subtotal = this.subtotalCents();
    const taxes = this.taxPreview();
    const dueNow = this.dueNowCents();
    const balance = Math.max(0, taxes.total - dueNow);
    const paymentsEnabled = this.data.settings.paymentsEnabled;

    const assetCards = assets.map((asset) => {
      const selected = this.selected.has(asset.id);
      const availabilityClass = asset.available === false ? 'unavailable' : asset.available === true ? 'available' : '';
      const price = searched && asset.available !== null
        ? this.money(asset.lineTotalCents, asset.currency)
        : asset.dailyRateCents > 0
          ? `${this.money(asset.dailyRateCents, asset.currency)} / jour`
          : 'Tarif sur demande';
      return `
        <button class="asset ${availabilityClass} ${selected ? 'selected' : ''}" data-asset="${this.escape(asset.id)}" ${asset.available === false || !searched ? 'disabled' : ''}>
          <span class="check">${selected ? '✓' : ''}</span>
          <span class="asset-main">
            <strong>${this.escape(asset.title)}</strong>
            <small>${this.escape(asset.productType || 'Équipement')}</small>
            ${searched && asset.billableDays ? `<small>${asset.billableDays} jour${asset.billableDays > 1 ? 's' : ''} · ${this.escape(asset.pricingMode)}</small>` : ''}
          </span>
          <span class="asset-price">${price}</span>
        </button>`;
    }).join('');

    const requiredAddress = this.isRequired('CUSTOMER_ADDRESS');
    const requiredPhone = this.isRequired('CUSTOMER_PHONE');

    this.root.innerHTML = `
      <style>
        :host{display:block;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#162033;--rf:#116dff;--rf-soft:#eef5ff;--border:#dce3ec;--muted:#64748b;--danger:#b42318;--success:#157347}
        *{box-sizing:border-box}.wrap{max-width:1100px;margin:auto;background:#fff;border:1px solid var(--border);border-radius:18px;overflow:hidden;box-shadow:0 12px 35px rgba(30,55,90,.08)}
        header{padding:24px 26px;background:linear-gradient(135deg,#f8fbff,#eef5ff);display:flex;align-items:center;gap:18px;border-bottom:1px solid var(--border)}
        header img{max-width:150px;max-height:66px;object-fit:contain}h1{font-size:26px;margin:0 0 4px}p{margin:0}.muted{color:var(--muted)}main{padding:24px}.section{margin-bottom:26px}.step{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--rf);margin-bottom:7px}h2{font-size:20px;margin:0 0 14px}
        .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.field{display:flex;flex-direction:column;gap:6px}.field.full{grid-column:1/-1}label{font-size:13px;font-weight:700}input,textarea,select{width:100%;border:1px solid #c9d2df;border-radius:10px;padding:11px 12px;font:inherit;background:#fff}textarea{min-height:82px;resize:vertical}input:focus,textarea:focus,select:focus{outline:2px solid rgba(17,109,255,.16);border-color:var(--rf)}
        .button{border:0;border-radius:10px;padding:11px 17px;font:inherit;font-weight:800;cursor:pointer;background:var(--rf);color:#fff}.button.secondary{background:#fff;color:var(--rf);border:1px solid var(--rf)}.button:disabled{opacity:.55;cursor:not-allowed}.search-row{display:flex;gap:12px;align-items:end}.search-row .field{flex:1}
        .notice{padding:12px 14px;border-radius:10px;margin:0 0 18px;font-size:14px}.notice.success{background:#ecfdf3;color:var(--success);border:1px solid #abefc6}.notice.error{background:#fef3f2;color:var(--danger);border:1px solid #fecdca}.notice.info{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe}
        .assets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.asset{width:100%;display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;text-align:left;padding:14px;border:1px solid var(--border);border-radius:12px;background:#fff;color:inherit;cursor:pointer}.asset:hover:not(:disabled){border-color:#9bbdfd;background:#fbfdff}.asset.selected{border:2px solid var(--rf);background:var(--rf-soft)}.asset.unavailable{opacity:.5}.asset-main{display:flex;flex-direction:column;gap:3px}.asset-main small{color:var(--muted)}.asset-price{font-weight:800;white-space:nowrap}.check{width:22px;height:22px;border:2px solid #b9c5d6;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff}.asset.selected .check{background:var(--rf);border-color:var(--rf)}
        .summary{background:#f8fafc;border:1px solid var(--border);border-radius:14px;padding:17px}.sumrow{display:flex;justify-content:space-between;gap:20px;padding:5px 0}.sumrow.total{font-size:18px;font-weight:900;border-top:1px solid var(--border);margin-top:7px;padding-top:12px}.sumrow.due{color:var(--rf);font-weight:900}.payment-options{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}.choice{display:flex;gap:8px;align-items:center;border:1px solid var(--border);border-radius:10px;padding:10px 13px;cursor:pointer}.choice.active{border-color:var(--rf);background:var(--rf-soft)}.choice input{width:auto}
        .complete{padding:28px;text-align:center;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px}.complete h2{color:#166534}.complete .number{font-size:20px;font-weight:900;margin:10px 0}.loading{padding:38px;text-align:center;color:var(--muted)}
        @media(max-width:720px){header{align-items:flex-start;flex-direction:column}.grid,.assets{grid-template-columns:1fr}.search-row{display:grid}.asset{grid-template-columns:28px 1fr}.asset-price{grid-column:2}.wrap{border-radius:12px}main{padding:18px}}
      </style>
      <div class="wrap">
        <header>
          ${company.logoUrl ? `<img src="${this.escape(company.logoUrl)}" alt="">` : ''}
          <div><h1>${this.escape(company.name || 'Réservation en ligne')}</h1><p class="muted">${paymentsEnabled ? 'Choisissez vos dates, vos équipements et payez de façon sécurisée avec Wix.' : 'Choisissez vos dates et vos équipements pour créer votre réservation.'}</p></div>
        </header>
        <main>
          ${this.error ? `<div class="notice error">${this.escape(this.error)}</div>` : ''}
          ${this.message ? `<div class="notice success">${this.escape(this.message)}</div>` : ''}
          ${!paymentsEnabled && !this.loading && !this.result ? '<div class="notice info">Le paiement en ligne n’est pas activé pour ce locateur. Le solde sera payable selon ses modalités.</div>' : ''}
          ${this.loading ? '<div class="loading">Chargement de la disponibilité…</div>' : this.result ? `
            <div class="complete">
              <h2>Votre réservation est créée</h2>
              <div class="number">${this.escape(this.result.reservationNumber)}</div>
              <p>Total : <strong>${this.money(this.result.totalCents, this.result.currency)}</strong></p>
              ${this.result.amountDueNowCents > 0 ? `<p style="margin-top:7px">À payer maintenant : <strong>${this.money(this.result.amountDueNowCents, this.result.currency)}</strong></p>` : ''}
              ${this.result.balanceDueCents > 0 ? `<p class="muted" style="margin-top:5px">Solde restant : ${this.money(this.result.balanceDueCents, this.result.currency)}</p>` : ''}
              ${this.result.checkoutUrl ? `<a class="button" style="display:inline-block;text-decoration:none;margin-top:18px" href="${this.escape(this.result.checkoutUrl)}">Payer avec Wix</a>` : '<p style="margin-top:14px">Aucun paiement en ligne immédiat requis.</p>'}
            </div>` : `
            <section class="section">
              <div class="step">1 · Dates</div><h2>Quand souhaitez-vous louer?</h2>
              <div class="search-row">
                <div class="field"><label>Début</label><input id="start" type="datetime-local" value="${this.escape(this.startValue)}"></div>
                <div class="field"><label>Fin</label><input id="end" type="datetime-local" value="${this.escape(this.endValue)}"></div>
                <button id="search" class="button" ${this.searching ? 'disabled' : ''}>${this.searching ? 'Recherche…' : 'Voir les disponibilités'}</button>
              </div>
            </section>
            <section class="section">
              <div class="step">2 · Équipements</div><h2>${searched ? 'Équipements disponibles' : 'Nos équipements'}</h2>
              ${assets.length ? `<div class="assets">${assetCards}</div>` : '<p class="muted">Aucun équipement actif pour le moment.</p>'}
            </section>
            ${selectedAssets.length ? `
              <section class="section">
                <div class="step">3 · Vos informations</div><h2>Coordonnées</h2>
                <div class="grid">
                  <div class="field"><label>Nom complet *</label><input name="customerName" autocomplete="name" value="${this.escape(this.customerDraft.customerName)}"></div>
                  <div class="field"><label>Courriel *</label><input name="customerEmail" type="email" autocomplete="email" value="${this.escape(this.customerDraft.customerEmail)}"></div>
                  <div class="field"><label>Téléphone ${requiredPhone ? '*' : ''}</label><input name="customerPhone" autocomplete="tel" value="${this.escape(this.customerDraft.customerPhone)}"></div>
                  <div class="field"><label>Adresse ${requiredAddress ? '*' : ''}</label><input name="addressLine1" autocomplete="street-address" value="${this.escape(this.customerDraft.addressLine1)}"></div>
                  <div class="field"><label>Adresse 2</label><input name="addressLine2" value="${this.escape(this.customerDraft.addressLine2)}"></div>
                  <div class="field"><label>Ville ${requiredAddress ? '*' : ''}</label><input name="city" autocomplete="address-level2" value="${this.escape(this.customerDraft.city)}"></div>
                  <div class="field"><label>Province / État ${requiredAddress ? '*' : ''}</label><input name="region" autocomplete="address-level1" value="${this.escape(this.customerDraft.region)}"></div>
                  <div class="field"><label>Code postal ${requiredAddress ? '*' : ''}</label><input name="postalCode" autocomplete="postal-code" value="${this.escape(this.customerDraft.postalCode)}"></div>
                  <div class="field"><label>Pays ${requiredAddress ? '*' : ''}</label><input name="country" autocomplete="country-name" value="${this.escape(this.customerDraft.country)}"></div>
                  <div class="field full"><label>Notes</label><textarea name="notes" placeholder="Information utile concernant votre réservation">${this.escape(this.customerDraft.notes)}</textarea></div>
                </div>
              </section>
              <section class="section">
                <div class="step">4 · ${paymentsEnabled ? 'Paiement' : 'Confirmation'}</div><h2>Résumé</h2>
                ${paymentsEnabled && this.data.settings.depositEnabled ? `<div class="payment-options">
                  <label class="choice ${this.paymentMode === 'DEPOSIT' ? 'active' : ''}"><input type="radio" name="paymentMode" value="DEPOSIT" ${this.paymentMode === 'DEPOSIT' ? 'checked' : ''}> Payer le dépôt (${this.data.settings.depositType === 'PERCENT' ? `${this.data.settings.depositValue}%` : this.money(Math.round(this.data.settings.depositValue * 100))})</label>
                  <label class="choice ${this.paymentMode === 'FULL' ? 'active' : ''}"><input type="radio" name="paymentMode" value="FULL" ${this.paymentMode === 'FULL' ? 'checked' : ''}> Payer en totalité</label>
                </div>` : ''}
                <div class="summary">
                  <div class="sumrow"><span>Sous-total</span><strong>${this.money(subtotal)}</strong></div>
                  ${this.data.settings.taxesEnabled ? `<div class="sumrow"><span>${this.escape(this.data.settings.tax1Name || 'Taxe 1')}</span><span>${this.money(taxes.tax1)}</span></div><div class="sumrow"><span>${this.escape(this.data.settings.tax2Name || 'Taxe 2')}</span><span>${this.money(taxes.tax2)}</span></div>` : ''}
                  <div class="sumrow total"><span>Total</span><span>${this.money(taxes.total)}</span></div>
                  ${paymentsEnabled ? `<div class="sumrow due"><span>À payer maintenant</span><span>${this.money(dueNow)}</span></div>` : ''}
                  ${balance > 0 ? `<div class="sumrow"><span>Solde restant</span><span>${this.money(balance)}</span></div>` : ''}
                </div>
                <button id="submit" class="button" style="width:100%;margin-top:14px;padding:14px" ${this.submitting ? 'disabled' : ''}>${this.submitting ? 'Création de la réservation…' : paymentsEnabled ? 'Réserver et continuer au paiement' : 'Créer la réservation'}</button>
              </section>` : ''}
          `}
        </main>
      </div>`;

    this.bindEvents();
  }

  private bindEvents() {
    const start = this.root.querySelector<HTMLInputElement>('#start');
    const end = this.root.querySelector<HTMLInputElement>('#end');
    start?.addEventListener('change', () => { this.startValue = start.value; });
    end?.addEventListener('change', () => { this.endValue = end.value; });
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
      void this.submitBooking();
    });
  }
}

if (!customElements.get('rental-flow-booking')) {
  customElements.define('rental-flow-booking', RentalFlowBookingElement);
}

export default RentalFlowBookingElement;
