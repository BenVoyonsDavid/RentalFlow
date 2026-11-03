import type { FC } from 'react';
import { useRentalFlowPlan } from '../lib/use-plan';
import { LocalizedScope, type RentalFlowLanguagePreference, useRentalFlowI18n } from './index';

export function withDashboardLocalization(PageComponent: FC, showLanguageSelector = false, allowWithoutSubscription = false): FC {
  const LocalizedPage: FC = () => {
    const { language, preference, setPreference, t } = useRentalFlowI18n('dashboard');
    // Resolve the actual Wix app plan before paid features are shown.
    const { plan, loading: planLoading } = useRentalFlowPlan();

    if (planLoading) {
      return (
        <LocalizedScope language={language}>
          <div style={{
            minHeight: 280,
            display: 'grid',
            placeItems: 'center',
            padding: 32,
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            color: '#64748b',
          }}>
            {t('Vérification de votre abonnement Wix…', 'Checking your Wix subscription…')}
          </div>
        </LocalizedScope>
      );
    }

    if (plan === 'NO_PLAN' && !allowWithoutSubscription) {
      return (
        <LocalizedScope language={language}>
          <div style={{
            maxWidth: 760,
            margin: '48px auto',
            padding: 28,
            border: '1px solid #fecaca',
            borderRadius: 14,
            background: '#fff',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}>
            <h2 style={{ marginTop: 0, color: '#111827' }}>
              {t('Abonnement RentalFlow requis', 'RentalFlow subscription required')}
            </h2>
            <p style={{ color: '#475569', lineHeight: 1.6 }}>
              {t(
                'Votre période d’essai est terminée ou aucun forfait RentalFlow actif n’est associé à ce site Wix. Choisissez Starter, Business ou Pro pour continuer à utiliser l’application.',
                'Your trial has ended or no active RentalFlow plan is associated with this Wix site. Choose Starter, Business, or Pro to continue using the app.',
              )}
            </p>
            <p style={{ color: '#64748b', marginBottom: 0 }}>
              {t(
                'Vous pouvez toujours ouvrir Paramètres → Abonnement pour vérifier le statut détecté par Wix.',
                'You can still open Settings → Subscription to verify the status detected from Wix.',
              )}
            </p>
          </div>
        </LocalizedScope>
      );
    }

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
