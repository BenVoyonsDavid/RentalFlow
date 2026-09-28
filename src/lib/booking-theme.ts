/** Shared by the settings preview, public API and booking widget. No arbitrary CSS. */
export type BookingTheme = { primary: string; heading: string; background: string; surface: string; text: string };
export const DEFAULT_BOOKING_THEME: BookingTheme = {
  primary: '#007f78', heading: '#102342', background: '#f4f7fb', surface: '#ffffff', text: '#263449',
};
export const BOOKING_PALETTES: { name: string; colors: BookingTheme }[] = [
  { name: 'Océan', colors: DEFAULT_BOOKING_THEME },
  { name: 'Forêt', colors: { primary: '#365c3e', heading: '#203524', background: '#f5f3ed', surface: '#fffef9', text: '#344138' } },
  { name: 'Bleu', colors: { primary: '#245cce', heading: '#132c58', background: '#f2f6fd', surface: '#ffffff', text: '#293b56' } },
  { name: 'Prune', colors: { primary: '#804c91', heading: '#392844', background: '#f8f4fa', surface: '#ffffff', text: '#47394d' } },
  { name: 'Ardoise', colors: { primary: '#5eead4', heading: '#f8fafc', background: '#101827', surface: '#1e293b', text: '#e2e8f0' } },
];
export const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export function normalizeBookingTheme(value: unknown): BookingTheme {
  let input = value;
  if (typeof input === 'string') { try { input = JSON.parse(input); } catch { input = {}; } }
  const record = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(DEFAULT_BOOKING_THEME).map(([key, fallback]) =>
    [key, isHexColor(record[key]) ? String(record[key]).toLowerCase() : fallback])) as BookingTheme;
}
function rgb(hex: string): number[] { return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)); }
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
  return .2126 * r + .7152 * g + .0722 * b;
}
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
function readable(foreground: string, background: string): string {
  if (contrastRatio(foreground, background) >= 4.5) return foreground;
  return contrastRatio('#ffffff', background) > contrastRatio('#000000', background) ? '#ffffff' : '#000000';
}
function mix(a: string, b: string, weight: number): string {
  const other = rgb(b);
  return '#' + rgb(a).map((v, i) => Math.round(v * weight + other[i] * (1 - weight)).toString(16).padStart(2, '0')).join('');
}
export function bookingThemeVariables(input: unknown): Record<string, string> {
  const theme = normalizeBookingTheme(input);
  const text = readable(theme.text, theme.surface);
  return {
    '--rf': theme.primary, '--rf-on-primary': readable('#ffffff', theme.primary),
    '--rf-bg': theme.background, '--rf-surface': theme.surface,
    '--rf-heading': readable(theme.heading, theme.surface), '--rf-text': text,
    '--rf-soft': mix(theme.primary, theme.surface, .10), '--rf-border': mix(text, theme.surface, .18),
    '--rf-muted': readable(mix(text, theme.surface, .7), theme.surface),
    '--rf-focus': readable(theme.primary, theme.surface),
  };
}

/** Accept web URLs and the CMS's Wix image URI, never javascript/data or markup. */
export function bookingImageUrl(value: unknown): string {
  let candidate = value;
  if (candidate && typeof candidate === 'object') {
    const image = candidate as Record<string, unknown>;
    candidate = image.src ?? image.url;
  }
  if (typeof candidate !== 'string') return '';
  const wix = candidate.match(/^wix:image:\/\/v1\/([a-z0-9_.~-]+)\//i);
  if (wix) return `https://static.wixstatic.com/media/${wix[1]}`;
  try { const url = new URL(candidate); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
