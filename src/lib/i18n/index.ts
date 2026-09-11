import english from './en.json';

export type Language = 'fr' | 'en';
export type Parameters = Record<string | number, string | number>;
const messages: Record<string, string> = english;

export function normalizeLanguage(value?: string | null): Language | undefined {
  const code = value?.toLowerCase().split(/[-_]/)[0];
  return code === 'fr' || code === 'en' ? code : undefined;
}

export function localeFor(language: Language): string {
  return language === 'en' ? 'en-CA' : 'fr-CA';
}

/** Only application-owned messages belong here. Never translate customer input. */
export function translate(source: string, language: Language, values: Parameters = {}): string {
  const message = language === 'en' ? messages[source] ?? source : source;
  // A callback preserves literal dollars, braces and markup in interpolated values.
  return message.replace(/\{(\w+)\}/g, (token, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : token);
}

export function createLanguageStore(scope: string) {
  const key = `rentalflow.language.${scope}`;
  const eventName = `rentalflow:language:${scope}`;
  let current: Language | undefined;
  const listeners = new Set<() => void>();
  function notify() { listeners.forEach((listener) => listener()); }
  function get(): Language {
    if (typeof window === 'undefined') return 'fr';
    if (current) return current;
    try { current = normalizeLanguage(window.localStorage.getItem(key)); } catch { /* Storage can be disabled in Wix embeds. */ }
    current ??= (scope === 'booking' ? normalizeLanguage(document.documentElement.lang) : undefined)
      ?? navigator.languages?.map(normalizeLanguage).find(Boolean)
      ?? normalizeLanguage(navigator.language) ?? 'fr';
    return current;
  }
  function set(language: Language) {
    current = language;
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(key, language); } catch { /* Keep the in-memory preference. */ }
      window.dispatchEvent(new CustomEvent(eventName, { detail: language }));
    }
    notify();
  }
  const onLocal = (event: Event) => {
    const language = normalizeLanguage((event as CustomEvent<string>).detail);
    if (language && language !== current) { current = language; notify(); }
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== key && event.key !== null) return;
    current = normalizeLanguage(event.newValue);
    notify();
  };
  function subscribe(listener: () => void) {
    listeners.add(listener);
    if (listeners.size === 1 && typeof window !== 'undefined') {
      window.addEventListener(eventName, onLocal);
      window.addEventListener('storage', onStorage);
    }
    return () => {
      listeners.delete(listener);
      if (!listeners.size && typeof window !== 'undefined') {
        window.removeEventListener(eventName, onLocal);
        window.removeEventListener('storage', onStorage);
      }
    };
  }
  return { get, set, subscribe };
}

export const dashboardLanguage = createLanguageStore('dashboard');
export const bookingLanguage = createLanguageStore('booking');
export const t = (source: string, values?: Parameters) => translate(source, dashboardLanguage.get(), values);
export const getLocale = () => localeFor(dashboardLanguage.get());

/** Keep feedback as a key + parameters so a language change can re-render it. */
export type Feedback = string | { source: string; values?: Parameters };
export function feedback(source: string, values?: Parameters): Feedback {
  return { source, values };
}
export function formatFeedback(value: Feedback, language = dashboardLanguage.get()): string {
  return typeof value === 'string' ? translate(value, language) : translate(value.source, language, value.values);
}
