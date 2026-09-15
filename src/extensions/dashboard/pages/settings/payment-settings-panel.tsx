import type { CSSProperties, FC } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { items } from '@wix/data';
import { useRentalFlowI18n } from '../../../../intl';
import {
  decodeStringList,
  maskedPaymentAccountId,
  normalizePaymentEnvironment,
  normalizePaymentProvider,
  paymentAccountStatus,
  type PaymentAccountStatus,
  type PaymentEnvironment,
  type PaymentProvider,
} from '../../../../lib/payment-provider';
import {
  getStripeConnectConfiguration,
  runStripeConnectAction,
  type StripeConnectPublicRecord,
} from '../../../../lib/stripe-connect-client';

const APP_SETTINGS = '@pilotedavid1/rental-flow/app-settings';
const CONNECT_JS_URL = 'https://connect-js.stripe.com/v1.0/connect.js';

const card: CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
  padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.06)',
};
const input: CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8,
  padding: '10px 12px', fontSize: 14, background: '#fff',
};
const primary: CSSProperties = {
  border: 0, borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600,
  cursor: 'pointer', background: '#116dff', color: '#fff',
};
const secondary: CSSProperties = {
  ...primary, border: '1px solid #116dff', background: '#fff', color: '#116dff',
};

type AppSettingsRecord = Record<string, unknown> & StripeConnectPublicRecord & {
  _id?: string;
  settingsKey?: string;
};

type ConnectElement = HTMLElement & {
  setOnExit?: (handler: () => void) => void;
  setCollectionOptions?: (options: {
    fields?: 'currently_due' | 'eventually_due';
    futureRequirements?: 'include' | 'omit';
  }) => void;
};

type ConnectInstance = {
  create: (component: string) => ConnectElement;
};

type StripeConnectGlobal = {
  onLoad?: () => void;
  init?: (options: {
    publishableKey: string;
    fetchClientSecret: () => Promise<string | undefined>;
    locale?: string;
    appearance?: { variables?: Record<string, string> };
  }) => ConnectInstance;
};

declare global {
  interface Window {
    StripeConnect?: StripeConnectGlobal;
  }
}

const emptyRecord: AppSettingsRecord = {
  settingsKey: 'default',
  payflowProvider: 'WIX',
  payflowEnvironment: 'TEST',
  payflowAccountStatus: 'NOT_CONNECTED',
  payflowDetailsSubmitted: false,
  payflowChargesEnabled: false,
  payflowPayoutsEnabled: false,
  payflowRequirementsCurrentlyDueJson: '[]',
  payflowRequirementsPastDueJson: '[]',
  payflowRequirementsPendingVerificationJson: '[]',
};

function loadConnectJs(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Stripe Connect requires a browser.'));
  if (window.StripeConnect?.init) return Promise.resolve();

  return new Promise((resolve, reject) => {
    window.StripeConnect = window.StripeConnect || {};
    const previousOnLoad = window.StripeConnect.onLoad;
    window.StripeConnect.onLoad = () => {
      previousOnLoad?.();
      resolve();
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CONNECT_JS_URL}"]`);
    if (existing) {
      existing.addEventListener('error', () => reject(new Error('Unable to load Stripe Connect.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = CONNECT_JS_URL;
    script.async = true;
    script.addEventListener('error', () => reject(new Error('Unable to load Stripe Connect.')), { once: true });
    document.head.appendChild(script);
  });
}

const PaymentSettingsPanel: FC = () => {
  const { t, locale } = useRentalFlowI18n('dashboard');
  const [record, setRecord] = useState<AppSettingsRecord>(emptyRecord);
  const [provider, setProvider] = useState<PaymentProvider>('WIX');
  const [environment, setEnvironment] = useState<PaymentEnvironment>('TEST');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [environmentConfigured, setEnvironmentConfigured] = useState({ TEST: false, LIVE: false });
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [publishableKey, setPublishableKey] = useState('');
  const onboardingContainerRef = useRef<HTMLDivElement>(null);

  const applyApiRecord = (apiRecord?: StripeConnectPublicRecord) => {
    if (!apiRecord) return;
    setRecord((current) => ({ ...current, ...apiRecord }));
    if (apiRecord.payflowProvider) setProvider(normalizePaymentProvider(apiRecord.payflowProvider));
    if (apiRecord.payflowEnvironment) setEnvironment(normalizePaymentEnvironment(apiRecord.payflowEnvironment));
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [result, stripeConfig] = await Promise.all([
          items.query(APP_SETTINGS).eq('settingsKey', 'default').limit(1).find(),
          getStripeConnectConfiguration().catch(() => null),
        ]);
        const existing = (result.items?.[0] as AppSettingsRecord | undefined) || emptyRecord;
        if (!active) return;
        setRecord(existing);
        setProvider(normalizePaymentProvider(existing.payflowProvider));
        setEnvironment(normalizePaymentEnvironment(existing.payflowEnvironment));
        if (stripeConfig?.environments) {
          setEnvironmentConfigured({
            TEST: stripeConfig.environments.TEST === true,
            LIVE: stripeConfig.environments.LIVE === true,
          });
        }
        if (stripeConfig?.record) applyApiRecord(stripeConfig.record);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : t('Impossible de charger les paramètres de paiement.', 'Unable to load payment settings.'));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [t]);

  const derivedStatus = useMemo<PaymentAccountStatus>(() => paymentAccountStatus({
    provider,
    environment,
    accountId: record.payflowAccountId,
    accountStatus: record.payflowAccountStatus,
    detailsSubmitted: record.payflowDetailsSubmitted,
    chargesEnabled: record.payflowChargesEnabled,
    payoutsEnabled: record.payflowPayoutsEnabled,
    requirementsCurrentlyDueJson: record.payflowRequirementsCurrentlyDueJson,
    requirementsPastDueJson: record.payflowRequirementsPastDueJson,
    requirementsPendingVerificationJson: record.payflowRequirementsPendingVerificationJson,
    country: record.payflowCountry,
    defaultCurrency: record.payflowDefaultCurrency,
    lastSyncedAt: record.payflowLastSyncedAt || undefined,
  }), [record, provider, environment]);

  const currentlyDue = decodeStringList(record.payflowRequirementsCurrentlyDueJson);
  const pastDue = decodeStringList(record.payflowRequirementsPastDueJson);
  const pendingVerification = decodeStringList(record.payflowRequirementsPendingVerificationJson);
  const stripeConfigured = environmentConfigured[environment];

  const statusLabel = (status: PaymentAccountStatus) => {
    if (status === 'READY') return t('Prêt', 'Ready');
    if (status === 'RESTRICTED') return t('Action requise', 'Action required');
    if (status === 'ONBOARDING') return t('Configuration en cours', 'Setup in progress');
    return t('Non connecté', 'Not connected');
  };

  const statusStyle = (status: PaymentAccountStatus): CSSProperties => {
    if (status === 'READY') return { background: '#dcfce7', color: '#166534' };
    if (status === 'RESTRICTED') return { background: '#fee2e2', color: '#991b1b' };
    if (status === 'ONBOARDING') return { background: '#fef3c7', color: '#92400e' };
    return { background: '#e2e8f0', color: '#334155' };
  };

  const save = async (): Promise<boolean> => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const environmentChanged = normalizePaymentEnvironment(record.payflowEnvironment) !== environment;
      const clearProviderAccount = environmentChanged && Boolean(record.payflowAccountId);
      const payload: AppSettingsRecord = {
        ...record,
        settingsKey: 'default',
        payflowProvider: provider,
        payflowEnvironment: environment,
        payflowAccountId: clearProviderAccount ? '' : record.payflowAccountId || '',
        payflowAccountStatus: clearProviderAccount ? 'NOT_CONNECTED' : record.payflowAccountStatus || 'NOT_CONNECTED',
        payflowDetailsSubmitted: clearProviderAccount ? false : record.payflowDetailsSubmitted === true,
        payflowChargesEnabled: clearProviderAccount ? false : record.payflowChargesEnabled === true,
        payflowPayoutsEnabled: clearProviderAccount ? false : record.payflowPayoutsEnabled === true,
        payflowRequirementsCurrentlyDueJson: clearProviderAccount ? '[]' : record.payflowRequirementsCurrentlyDueJson || '[]',
        payflowRequirementsPastDueJson: clearProviderAccount ? '[]' : record.payflowRequirementsPastDueJson || '[]',
        payflowRequirementsPendingVerificationJson: clearProviderAccount ? '[]' : record.payflowRequirementsPendingVerificationJson || '[]',
        payflowCountry: clearProviderAccount ? '' : record.payflowCountry || '',
        payflowDefaultCurrency: clearProviderAccount ? '' : record.payflowDefaultCurrency || '',
        payflowLastSyncedAt: clearProviderAccount ? null : record.payflowLastSyncedAt || null,
      };

      let saved: AppSettingsRecord;
      if (record._id) saved = await items.update(APP_SETTINGS, payload) as AppSettingsRecord;
      else saved = await items.insert(APP_SETTINGS, payload) as AppSettingsRecord;

      setRecord(saved);
      setProvider(normalizePaymentProvider(saved.payflowProvider));
      setEnvironment(normalizePaymentEnvironment(saved.payflowEnvironment));
      setSuccess(t('Paramètres de paiement enregistrés.', 'Payment settings saved.'));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Impossible d’enregistrer les paramètres de paiement.', 'Unable to save payment settings.'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const refreshStripeStatus = async (showSuccess = true) => {
    if (!record.payflowAccountId) return;
    setRefreshing(true);
    setError('');
    try {
      const response = await runStripeConnectAction('refresh', environment);
      applyApiRecord(response.record);
      if (showSuccess) setSuccess(t('Statut Stripe actualisé.', 'Stripe status refreshed.'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Impossible d’actualiser Stripe.', 'Unable to refresh Stripe.'));
    } finally {
      setRefreshing(false);
    }
  };

  const connectStripe = async () => {
    setConnecting(true);
    setError('');
    setSuccess('');
    try {
      if (provider !== 'PAYFLOW_STRIPE') setProvider('PAYFLOW_STRIPE');
      if (!(await save())) return;
      const response = await runStripeConnectAction('connect', environment);
      if (!response.publishableKey) throw new Error(t('Clé publiable Stripe indisponible.', 'Stripe publishable key is unavailable.'));
      applyApiRecord(response.record);
      setPublishableKey(response.publishableKey);
      setOnboardingOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Impossible de démarrer Stripe Connect.', 'Unable to start Stripe Connect.'));
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (!onboardingOpen || !publishableKey) return;
    let cancelled = false;
    let onboardingElement: ConnectElement | null = null;

    const mount = async () => {
      await loadConnectJs();
      if (cancelled) return;
      const stripeGlobal = window.StripeConnect;
      if (!stripeGlobal?.init) throw new Error('Stripe Connect failed to initialize.');

      const instance = stripeGlobal.init({
        publishableKey,
        locale: locale.toLowerCase().startsWith('fr') ? 'fr-FR' : 'en-US',
        appearance: { variables: { colorPrimary: '#116dff' } },
        fetchClientSecret: async () => {
          try {
            const response = await runStripeConnectAction('session', environment);
            applyApiRecord(response.record);
            return response.clientSecret;
          } catch (e) {
            setError(e instanceof Error ? e.message : t('Impossible de créer la session Stripe.', 'Unable to create the Stripe session.'));
            return undefined;
          }
        },
      });

      onboardingElement = instance.create('account-onboarding');
      onboardingElement.setCollectionOptions?.({ fields: 'eventually_due', futureRequirements: 'include' });
      onboardingElement.setOnExit?.(() => {
        setOnboardingOpen(false);
        void refreshStripeStatus(false);
      });

      const container = onboardingContainerRef.current;
      if (container && !cancelled) {
        container.replaceChildren(onboardingElement);
      }
    };

    void mount().catch((e) => {
      setError(e instanceof Error ? e.message : t('Impossible de charger l’onboarding Stripe.', 'Unable to load Stripe onboarding.'));
      setOnboardingOpen(false);
    });

    return () => {
      cancelled = true;
      onboardingElement?.remove();
    };
  }, [onboardingOpen, publishableKey, environment, locale, t]);

  const formatDate = (value?: Date | string | null) => {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (!date.getTime()) return '—';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };

  return (
    <>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0 }}>{t('Paiements', 'Payments')}</h2>
            <p style={{ color: '#64748b', marginBottom: 0, maxWidth: 760 }}>
              {t(
                'Choisissez la future configuration de paiement RentalFlow. Le flux réel demeure Wix jusqu’à ce qu’un compte PayFlow Stripe soit entièrement configuré.',
                'Choose RentalFlow’s future payment configuration. The live payment flow remains on Wix until a PayFlow Stripe account is fully configured.',
              )}
            </p>
          </div>
          <span style={{ ...statusStyle(provider === 'WIX' ? 'READY' : derivedStatus), borderRadius: 999, padding: '6px 10px', fontSize: 12, fontWeight: 700 }}>
            {provider === 'WIX' ? t('Wix actif', 'Wix active') : statusLabel(derivedStatus)}
          </span>
        </div>

        {error && <div style={{ marginTop: 16, background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: 12 }}>{error}</div>}
        {success && <div style={{ marginTop: 16, background: '#f0fdf4', color: '#166534', borderRadius: 8, padding: 12 }}>{success}</div>}

        {loading ? <div style={{ marginTop: 18 }}>{t('Chargement…', 'Loading…')}</div> : <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16, marginTop: 20 }}>
            <label>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{t('Fournisseur de paiement', 'Payment provider')}</span>
              <select style={input} value={provider} onChange={(e) => setProvider(e.target.value as PaymentProvider)}>
                <option value="WIX">Wix Payments / Payment Links</option>
                <option value="PAYFLOW_STRIPE">PayFlow Lite · Stripe Connect</option>
              </select>
            </label>

            {provider === 'PAYFLOW_STRIPE' && <label>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{t('Environnement', 'Environment')}</span>
              <select style={input} value={environment} onChange={(e) => setEnvironment(e.target.value as PaymentEnvironment)}>
                <option value="TEST">{t('Test — aucune vraie transaction', 'Test — no real transactions')}</option>
                <option value="LIVE">{t('Production — transactions réelles', 'Live — real transactions')}</option>
              </select>
            </label>}
          </div>

          {provider === 'PAYFLOW_STRIPE' && <div style={{ marginTop: 20, background: '#f8fafc', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
              <Info label={t('Compte Stripe', 'Stripe account')} value={maskedPaymentAccountId(record.payflowAccountId)} />
              <Info label={t('Statut', 'Status')} value={statusLabel(derivedStatus)} />
              <Info label={t('Paiements', 'Payments')} value={record.payflowChargesEnabled ? t('Activés', 'Enabled') : t('Non activés', 'Not enabled')} />
              <Info label={t('Versements', 'Payouts')} value={record.payflowPayoutsEnabled ? t('Activés', 'Enabled') : t('Non activés', 'Not enabled')} />
              <Info label={t('Pays', 'Country')} value={record.payflowCountry || '—'} />
              <Info label={t('Dernière synchro', 'Last sync')} value={formatDate(record.payflowLastSyncedAt)} />
            </div>

            {(currentlyDue.length > 0 || pastDue.length > 0 || pendingVerification.length > 0) && <div style={{ marginTop: 14, fontSize: 13, color: '#475569' }}>
              {t('Exigences Stripe', 'Stripe requirements')}: {currentlyDue.length} {t('actuelle(s)', 'currently due')}, {pastDue.length} {t('en retard', 'past due')}, {pendingVerification.length} {t('en vérification', 'pending verification')}.
            </div>}

            {!stripeConfigured && <div style={{ marginTop: 16, background: '#fff7ed', color: '#9a3412', borderRadius: 8, padding: 12, fontSize: 13 }}>
              {t(
                `La configuration Stripe ${environment === 'TEST' ? 'de test' : 'de production'} de la plateforme RentalFlow n’est pas encore définie.`,
                `RentalFlow’s Stripe ${environment === 'TEST' ? 'test' : 'live'} platform configuration is not set yet.`,
              )}
            </div>}

            {stripeConfigured && <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {record.payflowAccountId && <button
                style={{ ...secondary, opacity: refreshing ? .6 : 1 }}
                disabled={refreshing || connecting}
                onClick={() => void refreshStripeStatus()}
              >
                {refreshing ? t('Actualisation…', 'Refreshing…') : t('Actualiser le statut', 'Refresh status')}
              </button>}
              <button
                style={{ ...primary, opacity: connecting ? .6 : 1 }}
                disabled={connecting || refreshing}
                onClick={() => void connectStripe()}
              >
                {connecting
                  ? t('Connexion…', 'Connecting…')
                  : record.payflowAccountId
                    ? t('Continuer la configuration Stripe', 'Continue Stripe setup')
                    : t('Connecter Stripe', 'Connect Stripe')}
              </button>
            </div>}
          </div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <button style={{ ...primary, opacity: saving ? .6 : 1 }} disabled={saving || connecting} onClick={() => void save()}>
              {saving ? t('Enregistrement…', 'Saving…') : t('Enregistrer les paiements', 'Save payment settings')}
            </button>
          </div>
        </>}
      </div>

      {onboardingOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setOnboardingOpen(false);
              void refreshStripeStatus(false);
            }
          }}
        >
          <div style={{ width: '100%', maxWidth: 980, maxHeight: '94vh', overflowY: 'auto', background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(15,23,42,.25)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>{t('Configuration Stripe', 'Stripe setup')}</h2>
                <div style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>{t('Les informations bancaires et d’identité sont saisies directement dans Stripe.', 'Bank and identity information is entered directly in Stripe.')}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOnboardingOpen(false);
                  void refreshStripeStatus(false);
                }}
                style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 28, lineHeight: 1 }}
                aria-label={t('Fermer', 'Close')}
              >×</button>
            </div>
            <div ref={onboardingContainerRef} style={{ minHeight: 520, padding: 20 }}>
              <div style={{ color: '#64748b' }}>{t('Chargement de Stripe…', 'Loading Stripe…')}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const Info: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div style={{ color: '#64748b', fontSize: 12 }}>{label}</div>
    <div style={{ fontWeight: 700, marginTop: 4, overflowWrap: 'anywhere' }}>{value}</div>
  </div>
);

export default PaymentSettingsPanel;
