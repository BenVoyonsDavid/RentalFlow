import type { FC, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { i18n as wixI18n } from '@wix/essentials';
import { frToEn } from './translations';

export type RentalFlowLanguage = 'fr' | 'en';
export type RentalFlowLanguagePreference = 'auto' | RentalFlowLanguage;
export type RentalFlowI18nScope = 'dashboard' | 'site';

const STORAGE_KEY = 'rentalflow.language.preference';
const enToFr = Object.fromEntries(Object.entries(frToEn).map(([fr, en]) => [en, fr])) as Record<string, string>;

function normalizeLanguage(value?: string | null): RentalFlowLanguage {
  return String(value || '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

function getWixLanguage(): RentalFlowLanguage {
  try {
    return normalizeLanguage(wixI18n.getLanguage());
  } catch {
    if (typeof navigator !== 'undefined') return normalizeLanguage(navigator.language);
    return 'en';
  }
}

function getWixLocale(language: RentalFlowLanguage): string {
  try {
    const locale = wixI18n.getLocale();
    if (locale) return locale;
  } catch {
    // Fallback below.
  }
  return language === 'fr' ? 'fr-CA' : 'en-CA';
}

export function readLanguagePreference(): RentalFlowLanguagePreference {
  if (typeof window === 'undefined') return 'auto';
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'fr' || value === 'en' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

export function resolveLanguage(
  scope: RentalFlowI18nScope = 'dashboard',
  preference = readLanguagePreference(),
): RentalFlowLanguage {
  if (scope === 'site') return getWixLanguage();
  return preference === 'auto' ? getWixLanguage() : preference;
}

export function resolveLocale(
  scope: RentalFlowI18nScope = 'dashboard',
  preference = readLanguagePreference(),
): string {
  const language = resolveLanguage(scope, preference);
  if (scope === 'dashboard' && preference !== 'auto') return language === 'fr' ? 'fr-CA' : 'en-CA';
  return getWixLocale(language);
}

function translateDynamic(value: string, language: RentalFlowLanguage): string | null {
  if (language === 'en') {
    let match = value.match(/^(\d+) réservation\(s\)$/);
    if (match) return `${match[1]} reservation(s)`;
    match = value.match(/^(\d+) résultat\(s\)$/);
    if (match) return `${match[1]} result(s)`;
    match = value.match(/^\+ (\d+) autre\(s\)$/);
    if (match) return `+ ${match[1]} more`;
    match = value.match(/^(\d+) champ\(s\) obligatoire\(s\)$/);
    if (match) return `${match[1]} required field(s)`;
    match = value.match(/^(\d+) jour\(s\)$/);
    if (match) return `${match[1]} day(s)`;
    if (value === 'jour(s) ·') return 'day(s) ·';
    match = value.match(/^(.+)% après (\d+) jours$/);
    if (match) return `${match[1]}% after ${match[2]} days`;
    match = value.match(/^(\d+) équipement(?:s)? disponible(?:s)?\.$/);
    if (match) return `${match[1]} piece(s) of equipment available.`;
    match = value.match(/^Réservation (.+) créée avec succès\.$/);
    if (match) return `Reservation ${match[1]} created successfully.`;
    match = value.match(/^Réservation (.+) créée\.$/);
    if (match) return `Reservation ${match[1]} created.`;
    match = value.match(/^(.+) a été ajouté\.$/);
    if (match) return `${match[1]} was added.`;
    match = value.match(/^(.+) a été modifié\.$/);
    if (match) return `${match[1]} was updated.`;
  } else {
    let match = value.match(/^(\d+) reservation\(s\)$/);
    if (match) return `${match[1]} réservation(s)`;
    match = value.match(/^(\d+) result\(s\)$/);
    if (match) return `${match[1]} résultat(s)`;
    match = value.match(/^\+ (\d+) more$/);
    if (match) return `+ ${match[1]} autre(s)`;
    match = value.match(/^(\d+) required field\(s\)$/);
    if (match) return `${match[1]} champ(s) obligatoire(s)`;
    match = value.match(/^(\d+) day\(s\)$/);
    if (match) return `${match[1]} jour(s)`;
    if (value === 'day(s) ·') return 'jour(s) ·';
    match = value.match(/^(.+)% after (\d+) days$/);
    if (match) return `${match[1]}% après ${match[2]} jours`;
    match = value.match(/^(\d+) piece\(s\) of equipment available\.$/);
    if (match) return `${match[1]} équipement(s) disponible(s).`;
    match = value.match(/^Reservation (.+) created successfully\.$/);
    if (match) return `Réservation ${match[1]} créée avec succès.`;
    match = value.match(/^Reservation (.+) created\.$/);
    if (match) return `Réservation ${match[1]} créée.`;
  }
  return null;
}

function translateDecorated(value: string, dictionary: Record<string, string>): string | null {
  let match = value.match(/^(.+?)\s+\*$/);
  if (match && dictionary[match[1]]) return `${dictionary[match[1]]} *`;

  match = value.match(/^(.+?)\s+\((.+)\)$/);
  if (match && dictionary[match[1]]) return `${dictionary[match[1]]} (${match[2]})`;

  match = value.match(/^(.+?)\s*:\s*$/);
  if (match && dictionary[match[1]]) return `${dictionary[match[1]]}:`;

  return null;
}

export function translateText(value: string, language: RentalFlowLanguage): string {
  if (!value) return value;
  const leading = value.match(/^\s*/)?.[0] || '';
  const trailing = value.match(/\s*$/)?.[0] || '';
  const trimmed = value.trim();
  if (!trimmed) return value;

  const dictionary = language === 'en' ? frToEn : enToFr;
  const translated = dictionary[trimmed] || translateDecorated(trimmed, dictionary) || translateDynamic(trimmed, language);
  return translated == null ? value : `${leading}${translated}${trailing}`;
}

function localizeElementAttributes(element: Element, language: RentalFlowLanguage) {
  for (const attribute of ['placeholder', 'title', 'aria-label', 'alt']) {
    const current = element.getAttribute(attribute);
    if (!current) continue;
    const next = translateText(current, language);
    if (next !== current) element.setAttribute(attribute, next);
  }
}

function localizeNode(node: Node, language: RentalFlowLanguage) {
  if (node.nodeType === 3) {
    const parent = node.parentElement;
    if (parent && ['SCRIPT', 'STYLE'].includes(parent.tagName)) return;
    const current = node.nodeValue || '';
    const next = translateText(current, language);
    if (next !== current) node.nodeValue = next;
    return;
  }
  if (node.nodeType === 1) localizeElementAttributes(node as Element, language);
}

export function localizeDom(root: Node, language: RentalFlowLanguage): void {
  if (typeof document === 'undefined') return;
  localizeNode(root, language);
  const ownerDocument = root.ownerDocument || document;
  const nodeFilter = ownerDocument.defaultView?.NodeFilter || globalThis.NodeFilter;
  if (!nodeFilter) return;
  const walker = ownerDocument.createTreeWalker(root, nodeFilter.SHOW_ELEMENT | nodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    localizeNode(current, language);
    current = walker.nextNode();
  }
}

export function useRentalFlowI18n(scope: RentalFlowI18nScope = 'dashboard') {
  const [preference, setPreferenceState] = useState<RentalFlowLanguagePreference>(() =>
    scope === 'site' ? 'auto' : readLanguagePreference(),
  );
  const language = useMemo(() => resolveLanguage(scope, preference), [scope, preference]);
  const locale = useMemo(() => resolveLocale(scope, preference), [scope, preference]);

  const setPreference = useCallback((next: RentalFlowLanguagePreference) => {
    if (scope === 'site') return;
    setPreferenceState(next);
    if (typeof window !== 'undefined') {
      try {
        if (next === 'auto') window.localStorage.removeItem(STORAGE_KEY);
        else window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Keep the in-memory preference even if storage is unavailable.
      }
    }
  }, [scope]);

  useEffect(() => {
    if (scope === 'site' || typeof window === 'undefined') return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setPreferenceState(readLanguagePreference());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [scope]);

  const t = useCallback((fr: string, en: string) => language === 'fr' ? fr : en, [language]);
  return { language, locale, preference, setPreference, t };
}

export const LocalizedScope: FC<{ language: RentalFlowLanguage; children: ReactNode }> = ({ language, children }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    localizeDom(root, language);
    if (typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') localizeNode(mutation.target, language);
        if (mutation.type === 'attributes') localizeNode(mutation.target, language);
        mutation.addedNodes.forEach((node) => localizeDom(node, language));
      }
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label', 'alt'],
    });
    return () => observer.disconnect();
  }, [language]);

  return <div ref={ref} style={{ display: 'contents' }}>{children}</div>;
};
