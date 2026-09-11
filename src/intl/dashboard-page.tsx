import type { FC } from 'react';
import { useRentalFlowPlan } from '../lib/use-plan';
import { LocalizedScope, type RentalFlowLanguagePreference, useRentalFlowI18n } from './index';

export function withDashboardLocalization(PageComponent: FC, showLanguageSelector = false): FC {
  const LocalizedPage: FC = () => {
    const { language, preference, setPreference, t } = useRentalFlowI18n('dashboard');
    // Resolve and cache the installed Wix pricing package for legacy pages that
    // still use the synchronous compatibility accessor in plans.ts.
    useRentalFlowPlan();

    return (
      <LocalizedScope language={language}>
        {showLanguageSelector ? (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            padding: '10px 20px 0',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              {t('Langue de l’interface', 'Interface language')}
            </span>
            <select
              aria-label={t('Langue de l’interface', 'Interface language')}
              value={preference}
              onChange={(event) => setPreference(event.target.value as RentalFlowLanguagePreference)}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                background: '#fff',
                padding: '7px 10px',
                fontSize: 13,
              }}
            >
              <option value="auto">{t('Automatique (langue Wix)', 'Automatic (Wix language)')}</option>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
        ) : null}
        <PageComponent />
      </LocalizedScope>
    );
  };

  LocalizedPage.displayName = `Localized${PageComponent.displayName || PageComponent.name || 'RentalFlowPage'}`;
  return LocalizedPage;
}
