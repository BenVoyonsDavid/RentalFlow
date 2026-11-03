import { useState, type CSSProperties } from 'react';
import { BOOKING_PALETTES, DEFAULT_BOOKING_THEME, bookingThemeVariables, isHexColor, normalizeBookingTheme, type BookingTheme } from '../../../../lib/booking-theme';
import { useRentalFlowI18n } from '../../../../intl';

const fields: { key: keyof BookingTheme; fr: string; en: string }[] = [
  { key: 'primary', fr: 'Boutons et sélection', en: 'Buttons and selection' },
  { key: 'heading', fr: 'Titres', en: 'Headings' },
  { key: 'background', fr: 'Arrière-plan', en: 'Background' },
  { key: 'surface', fr: 'Cartes et panneaux', en: 'Cards and panels' },
  { key: 'text', fr: 'Texte', en: 'Text' },
];
function ColorField({ value, label, onChange }: { value: string; label: string; onChange: (color: string) => void }) {
  const [draft, setDraft] = useState(value);
  const invalid = !isHexColor(draft);
  return <label style={{ display: 'grid', gap: 7, fontSize: 14 }}>
    <strong>{label}</strong>
    <span style={{ display: 'flex', gap: 8 }}>
      <input aria-label={label} type="color" value={value} onChange={(event) => { setDraft(event.target.value); onChange(event.target.value); }} style={{ width: 48, height: 42, padding: 3, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }} />
      <input aria-label={`${label} HEX`} aria-invalid={invalid} value={draft} maxLength={7} spellCheck={false}
        onChange={(event) => { setDraft(event.target.value); if (isHexColor(event.target.value)) onChange(event.target.value); }}
        onBlur={() => { if (invalid) setDraft(value); }}
        style={{ minWidth: 0, width: 130, padding: 9, border: `1px solid ${invalid ? '#b42318' : '#cbd5e1'}`, borderRadius: 8, fontFamily: 'monospace' }} />
    </span>
  </label>;
}
export default function BookingAppearance({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  const { t } = useRentalFlowI18n();
  const colors = normalizeBookingTheme(value);
  const [revision, setRevision] = useState(0);
  const apply = (theme: BookingTheme) => { onChange(JSON.stringify(theme)); setRevision((n) => n + 1); };
  const style = { ...bookingThemeVariables(colors), background: 'var(--rf-bg)', color: 'var(--rf-text)', borderRadius: 14, padding: 20 } as CSSProperties;
  return <div>
    <h2 style={{ marginTop: 0 }}>{t('Apparence du module de réservation', 'Booking widget appearance')}</h2>
    <p>{t('Personnalisez les couleurs pour les adapter à votre entreprise.', 'Customize the colors to match your business.')}</p>
    <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', margin: '20px 0' }}>
      {BOOKING_PALETTES.map((preset) => <button key={preset.name} type="button" onClick={() => apply(preset.colors)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #cbd5e1', borderRadius: 30, background: '#fff', color: '#162033', padding: '9px 13px', cursor: 'pointer' }}>
        <span aria-hidden="true" style={{ width: 18, height: 18, background: preset.colors.primary, borderRadius: '50%', border: '1px solid #cbd5e1' }} />
        {preset.name}
      </button>)}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 18 }}>
      {fields.map((field) => <ColorField key={`${field.key}-${revision}`} label={t(field.fr, field.en)} value={colors[field.key]} onChange={(color) => onChange(JSON.stringify({ ...colors, [field.key]: color }))} />)}
    </div>
    <p style={{ fontSize: 13, color: '#526175', margin: '18px 0' }}>{t('Le contraste du texte est ajusté automatiquement pour rester lisible. Enregistrez pour appliquer les couleurs à votre site.', 'Text contrast is adjusted automatically for readability. Save to apply the colors to your site.')}</p>
    <h3>{t('Aperçu des couleurs', 'Color preview')}</h3>
    <div style={style} data-booking-theme-preview>
      <div style={{ background: 'var(--rf-surface)', border: '1px solid var(--rf-border)', padding: 20, borderRadius: 12 }}>
        <h3 style={{ color: 'var(--rf-heading)', marginTop: 0 }}>{t('Planifiez votre location', 'Plan your rental')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14 }}>
          <div style={{ padding: 14, border: '1px solid var(--rf-border)', borderRadius: 10 }}><strong>{t('Vos dates', 'Your dates')}</strong><p style={{ color: 'var(--rf-muted)' }}>12 → 14</p><span style={{ background: 'var(--rf)', color: 'var(--rf-on-primary)', padding: '6px 10px', borderRadius: 8 }}>12</span></div>
          <div style={{ padding: 14, background: 'var(--rf-soft)', border: '1px solid var(--rf)', borderRadius: 10 }}><strong>{t('Équipement sélectionné', 'Selected equipment')}</strong><p style={{ color: 'var(--rf-muted)' }}>{t('Disponible', 'Available')}</p></div>
          <div style={{ padding: 14, border: '1px solid var(--rf-border)', borderRadius: 10 }}><strong>{t('Votre réservation', 'Your reservation')}</strong><p style={{ color: 'var(--rf-muted)' }}>{t('Résumé', 'Summary')}</p><span style={{ display: 'block', textAlign: 'center', padding: 10, borderRadius: 8, background: 'var(--rf)', color: 'var(--rf-on-primary)', fontWeight: 700 }}>{t('Continuer', 'Continue')}</span></div>
        </div>
      </div>
    </div>
    <button type="button" onClick={() => apply(DEFAULT_BOOKING_THEME)} style={{ marginTop: 18, padding: '9px 13px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer' }}>{t('Rétablir les couleurs par défaut', 'Reset default colors')}</button>
  </div>;
}
