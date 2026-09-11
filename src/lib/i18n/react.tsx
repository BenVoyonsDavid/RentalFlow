import { useSyncExternalStore } from 'react';
import { dashboardLanguage, t, type Language } from './index';

export function useLanguage(): Language {
  return useSyncExternalStore(dashboardLanguage.subscribe, dashboardLanguage.get, () => 'fr');
}

export function LanguageSelector() {
  const language = useLanguage();
  return (
    <div lang={language} style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 24px', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
        {t('Langue')}
        <select value={language} onChange={(event) => dashboardLanguage.set(event.target.value as Language)}
          style={{ font: 'inherit', background: '#fff', color: '#162033', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 12px' }}>
          <option value="fr" lang="fr">Français</option>
          <option value="en" lang="en">English</option>
        </select>
      </label>
    </div>
  );
}
