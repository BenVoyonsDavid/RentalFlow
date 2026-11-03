import { bookingImageUrl } from '../../../../lib/booking-theme';
import { resolveLocale } from '../../../../intl';
import type { PublicAsset } from './booking-widget-state';

export function escapeBookingHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char));
}

export function renderBookingCalendar(input: {
  calendarMonth: Date;
  startValue: string;
  endValue: string;
  searching: boolean;
  submitting: boolean;
}): string {
  const { calendarMonth, startValue, endValue, searching, submitting } = input;
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const dateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const today = dateKey(new Date());
  const first = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const locale = resolveLocale('site', 'auto');
  const start = startValue.slice(0, 10);
  const end = endValue.slice(0, 10);

  const weekdays = Array.from(
    { length: 7 },
    (_, index) =>
      `<span>${new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2024, 0, 1 + index))}</span>`,
  ).join('');

  const days = Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month, index + 1);
    const key = dateKey(date);
    const edge = key === start || key === end;
    const inRange = Boolean(start && end && key > start && key < end);
    const disabled = key < today || searching || submitting;
    const label = escapeBookingHtml(
      new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(date),
    );

    return `<button type="button" data-day="${key}" class="day ${edge ? 'edge' : ''} ${inRange ? 'range' : ''}" aria-label="${label}" aria-pressed="${edge}" ${disabled ? 'disabled' : ''}>${index + 1}</button>`;
  }).join('');

  return `<div class="calendar"><div class="month"><button type="button" data-month="-1" aria-label="Mois précédent">‹</button><strong>${escapeBookingHtml(new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(calendarMonth))}</strong><button type="button" data-month="1" aria-label="Mois suivant">›</button></div><div class="days">${weekdays}${'<span></span>'.repeat(first)}${days}</div><p class="muted calendar-hint">Sélectionnez le début, puis la fin.</p></div>`;
}

export function renderBookingAssetCards(input: {
  assets: PublicAsset[];
  selected: Set<string>;
  searched: boolean;
  submitting: boolean;
  language: 'fr' | 'en';
  money: (cents: number, currency: string) => string;
}): string {
  const {
    assets,
    selected,
    searched,
    submitting,
    language,
    money,
  } = input;

  return assets.map((asset) => {
    const isSelected = selected.has(asset.id);
    const availabilityClass = asset.available === false
      ? 'unavailable'
      : asset.available === true
        ? 'available'
        : '';
    const price = searched && asset.available !== null
      ? money(asset.lineTotalCents, asset.currency)
      : asset.dailyRateCents > 0
        ? `${money(asset.dailyRateCents, asset.currency)} / ${language === 'en' ? 'day' : 'jour'}`
        : 'Tarif sur demande';
    const imageUrl = bookingImageUrl(asset.imageUrl);

    return `
      <button class="asset ${availabilityClass} ${isSelected ? 'selected' : ''}" aria-pressed="${isSelected}" data-asset="${escapeBookingHtml(asset.id)}" ${asset.available !== true || submitting ? 'disabled' : ''}>
        <span class="asset-image">${imageUrl ? `<img src="${escapeBookingHtml(imageUrl)}" alt="" loading="lazy">` : '<span aria-hidden="true">◇</span>'}</span>
        <span class="asset-main">
          <strong translate="no">${escapeBookingHtml(asset.title)}</strong>
          <small translate="no">${escapeBookingHtml(asset.productType || 'Équipement')}</small>
          ${searched && asset.billableDays ? `<small>${asset.billableDays} ${language === 'en' ? 'day' : 'jour'}${asset.billableDays > 1 ? 's' : ''}</small>` : ''}
        </span>
        <span class="asset-price">${price}<small>${isSelected ? 'Sélectionné' : asset.available === true ? 'Disponible' : asset.available === false ? 'Indisponible' : 'Choisissez vos dates'}</small></span>
      </button>`;
  }).join('');
}
