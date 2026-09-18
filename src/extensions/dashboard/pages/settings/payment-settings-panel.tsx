import type { CSSProperties, FC } from 'react';
import { useEffect, useMemo, useState } from 'react';
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
  getSquareConnectConfiguration,
  runSquareConnectAction,
  type SquarePaymentAccountRecord,
} from '../../../../lib/square-connect-client';

const APP_SETTINGS = '@pilotedavid1/rental-flow/app-settings';

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
  ...primary, background: '#fff', color: '#116dff', border: '1px solid #116dff',
};

type AppSettingsRecord = Record<string, unknown> & {
  _id?: string;
  settingsKey?: string;
  payflowProvider?: string;
  payflowEnvironment?: string;
  payflowAccountId?: string;
  payflowAccountStatus?: string;
  payflowDetailsSubmitted?: boolean;
  payflowChargesEnabled?: boolean;
  payflowPayoutsEnabled?: boolean;
  payflowRequirementsCurrentlyDueJson?: string;
  payflowRequirementsPastDueJson?: string;
  payflowRequirementsPendingVerificationJson?: string;
  payflowCountry?: string;
  payflowDefaultCurrency?: string;
  payflowLastSyncedAt?: Date | string | null;
};

const emptyRecord: AppSettingsRecord = {
  settingsKey: 'default',
  payflowProvider: 'WIX',
  payflowEnvironment: 'TEST',
};

const emptyAccount: SquarePaymentAccountRecord = {
  settingsKey: 'default',
  provider: 'PAYFLOW_SQUARE',
  environment: 'TEST',
  accountStatus: 'NOT_CONNECTED',
  detailsSubmitted: false,
  chargesEnabled: false,
  payoutsEnabled: false,
  requirementsCurrentlyDueJson: '[]',
  requirementsPastDueJson: '[]',
  requirementsPendingVerificationJson: '[]',
};

const PaymentSettingsPanel: FC = () => {
  const { t, locale } = useRentalFlowI18n('dashboard');
  const [record, setRecord] = useState<AppSettingsRecord>(emptyRecord);
  const [paymentAccount, setPaymentAccount] = useState<SquarePaymentAccountRecord>(emptyAccount);
  const [provider, setProvider] = useState<PaymentProvider>('WIX');
  const [environment, setEnvironment] = useState<PaymentEnvironment>('TEST');
  const [environmentConfigured, setEnvironmentConfigured] = useState({ TEST: false, LIVE: false });
  const [callbackUrl, setCallbackUrl] = useState('');
  const [callbackIsHttps, setCallbackIsHttps] = useState(false);
  const [authorizeUrl, setAuthorizeUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const expectedCallbackOrigin = useMemo(() => {
    try {
      return callbackUrl ? new URL(callbackUrl).origin : '';
    } catch {
      return '';
    }
  }, [callbackUrl]);

  const applyAccount = (account?: SquarePaymentAccountRecord | null) => {
    if (account) setPaymentAccount({ ...emptyAccount, ...account });
    else setPaymentAccount(emptyAccount);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [result, squareConfig] = await Promise.all([
          items.query(APP_SETTINGS).eq('settingsKey', 'default').limit(1).find(),
          getSquareConnectConfiguration().catch((e) => {
            if (active) {
              setError(
                e instanceof Error
                  ? `Square backend: ${e.message}`
                  : t('Impossible de joindre le backend Square.', 'Unable to reach the Square backend.'),
              );
            }
            return null;
          }),
        ]);
        const existing = (result.items?.[0] as AppSettingsRecord | undefined) || emptyRecord;
        if (!active) return;
        setRecord(existing);
        setProvider(normalizePaymentProvider(existing.payflowProvider));
        setEnvironment(normalizePaymentEnvironment(existing.payflowEnvironment));
        if (squareConfig) {
          setEnvironmentConfigured({
            TEST: squareConfig.environments?.TEST === true,
            LIVE: squareConfig.environments?.LIVE === true,
          });
          setCallbackUrl(squareConfig.callbackUrl || '');
          setCallbackIsHttps(squareConfig.callbackIsHttps === true);
          applyAccount(squareConfig.account);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : t('Impossible de charger les paramètres de paiement.', 'Unable to load payment settings.'));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [t]);

  const refreshSquare = async (showSuccess = true) => {
    setRefreshing(true);
    setError('');
    try {
      const result = await runSquareConnectAction('refresh', environment);
      applyAccount(result.account);
      if (showSuccess) setSuccess(t('Connexion Square actualisée.', 'Square connection refreshed.'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Impossible d’actualiser Square.', 'Unable to refresh Square.'));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (expectedCallbackOrigin && event.origin !== expectedCallbackOrigin) return;
      const data = event.data as {
        type?: string;
        ok?: boolean;
        code?: string;
        state?: string;
        environment?: string;
        squareError?: string;
      } | null;
      if (!data || data.type !== 'rentalflow-square-oauth') return;

      if (!data.ok) {
        setError(t('La connexion Square n’a pas été terminée.', 'Square connection was not completed.'));
        return;
      }

      if (!data.code || !data.state) {
        setError(t('Le retour de Square est incomplet. Relancez la connexion.', 'The Square callback is incomplete. Start the connection again.'));
        return;
      }

      const callbackEnvironment = normalizePaymentEnvironment(data.environment);
      setConnecting(true);
      setError('');
      setSuccess(t('Autorisation reçue. Finalisation de la connexion Square…', 'Authorization received. Finishing the Square connection…'));

      void runSquareConnectAction('complete', callbackEnvironment, {
        code: data.code,
        state: data.state,
      }).then((result) => {
        applyAccount(result.account);
        setEnvironment(callbackEnvironment);
        setSuccess(t('Square est connecté à RentalFlow.', 'Square is connected to RentalFlow.'));
      }).catch((e) => {
        setError(e instanceof Error ? e.message : t('Impossible de terminer la connexion Square.', 'Unable to finish the Square connection.'));
      }).finally(() => {
        setConnecting(false);
      });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [expectedCallbackOrigin, t]);

  // Wix Dashboard pages run inside a hosted frame. Opening a blank popup and then
  // navigating it after asynchronous work can be blocked silently by the browser.
  // Prepare the short-lived Square OAuth URL ahead of the click so the visible
  // Connect link performs a normal user-initiated navigation.
  useEffect(() => {
    let active = true;
    setAuthorizeUrl('');

    if (
      provider !== 'PAYFLOW_SQUARE'
      || !callbackIsHttps
      || !environmentConfigured[environment]
    ) {
      return () => { active = false; };
    }

    const prepare = async () => {
      setConnecting(true);
      try {
        const result = await runSquareConnectAction('start', environment);
        if (!active) return;
        if (!result.authorizeUrl) {
          throw new Error(t('Square n’a pas retourné de lien d’autorisation.', 'Square did not return an authorization link.'));
        }
        setAuthorizeUrl(result.authorizeUrl);
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : t('Impossible de préparer la connexion Square.', 'Unable to prepare the Square connection.'));
        }
      } finally {
        if (active) setConnecting(false);
      }
    };

    void prepare();
    return () => { active = false; };
  }, [provider, environment, callbackIsHttps, environmentConfigured.TEST, environmentConfigured.LIVE, t]);

  // If the browser does not preserve window.opener, refresh the non-sensitive
  // account snapshot when the merchant returns to the Wix Dashboard tab.
  useEffect(() => {
    const onFocus = async () => {
      if (provider !== 'PAYFLOW_SQUARE') return;
      try {
        const config = await getSquareConnectConfiguration();
        applyAccount(config.account);
      } catch {
        // The explicit refresh action remains available if Wix is still restoring context.
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [provider]);

  const derivedStatus = useMemo<PaymentAccountStatus>(() => paymentAccountStatus({
    provider,
    environment,
    accountId: provider === 'PAYFLOW_SQUARE' ? paymentAccount.accountId : record.payflowAccountId,
    accountStatus: provider === 'PAYFLOW_SQUARE' ? paymentAccount.accountStatus : record.payflowAccountStatus,
    detailsSubmitted: provider === 'PAYFLOW_SQUARE' ? paymentAccount.detailsSubmitted : record.payflowDetailsSubmitted,
    chargesEnabled: provider === 'PAYFLOW_SQUARE' ? paymentAccount.chargesEnabled : record.payflowChargesEnabled,
    payoutsEnabled: provider === 'PAYFLOW_SQUARE' ? paymentAccount.payoutsEnabled : record.payflowPayoutsEnabled,
    requirementsCurrentlyDueJson: provider === 'PAYFLOW_SQUARE' ? paymentAccount.requirementsCurrentlyDueJson : record.payflowRequirementsCurrentlyDueJson,
    requirementsPastDueJson: provider === 'PAYFLOW_SQUARE' ? paymentAccount.requirementsPastDueJson : record.payflowRequirementsPastDueJson,
    requirementsPendingVerificationJson: provider === 'PAYFLOW_SQUARE' ? paymentAccount.requirementsPendingVerificationJson : record.payflowRequirementsPendingVerificationJson,
    country: provider === 'PAYFLOW_SQUARE' ? paymentAccount.country : record.payflowCountry,
    defaultCurrency: provider === 'PAYFLOW_SQUARE' ? paymentAccount.defaultCurrency : record.payflowDefaultCurrency,
    lastSyncedAt: provider === 'PAYFLOW_SQUARE' ? paymentAccount.lastSyncedAt || undefined : record.payflowLastSyncedAt || undefined,
  }), [record, paymentAccount, provider, environment]);

  const currentlyDue = decodeStringList(provider === 'PAYFLOW_SQUARE' ? paymentAccount.requirementsCurrentlyDueJson : record.payflowRequirementsCurrentlyDueJson);
  const pastDue = decodeStringList(provider === 'PAYFLOW_SQUARE' ? paymentAccount.requirementsPastDueJson : record.payflowRequirementsPastDueJson);
  const pendingVerification = decodeStringList(provider === 'PAYFLOW_SQUARE' ? paymentAccount.requirementsPendingVerificationJson : record.payflowRequirementsPendingVerificationJson);

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
      const providerChanged = normalizePaymentProvider(record.payflowProvider) !== provider;
      const environmentChanged = normalizePaymentEnvironment(record.payflowEnvironment) !== environment;
      const clearLegacyProviderAccount = providerChanged || environmentChanged;
      const payload: AppSettingsRecord = {
        ...record,
        settingsKey: 'default',
        payflowProvider: provider,
        payflowEnvironment: environment,
        payflowAccountId: clearLegacyProviderAccount ? '' : record.payflowAccountId || '',
        payflowAccountStatus: clearLegacyProviderAccount ? 'NOT_CONNECTED' : record.payflowAccountStatus || 'NOT_CONNECTED',
        payflowDetailsSubmitted: clearLegacyProviderAccount ? false : record.payflowDetailsSubmitted === true,
        payflowChargesEnabled: clearLegacyProviderAccount ? false : record.payflowChargesEnabled === true,
        payflowPayoutsEnabled: clearLegacyProviderAccount ? false : record.payflowPayoutsEnabled === true,
        payflowRequirementsCurrentlyDueJson: clearLegacyProviderAccount ? '[]' : record.payflowRequirementsCurrentlyDueJson || '[]',
        payflowRequirementsPastDueJson: clearLegacyProviderAccount ? '[]' : record.payflowRequirementsPastDueJson || '[]',
        payflowRequirementsPendingVerificationJson: clearLegacyProviderAccount ? '[]' : record.payflowRequirementsPendingVerificationJson || '[]',
        payflowCountry: clearLegacyProviderAccount ? '' : record.payflowCountry || '',
        payflowDefaultCurrency: clearLegacyProviderAccount ? '' : record.payflowDefaultCurrency || '',
        payflowLastSyncedAt: clearLegacyProviderAccount ? null : record.payflowLastSyncedAt || null,
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

  const formatDate = (value?: Date | string | null) => {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (!date.getTime()) return '—';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };

  const accountForDisplay = provider === 'PAYFLOW_SQUARE' ? paymentAccount : record;
  const providerName = provider === 'PAYFLOW_SQUARE' ? 'Square' : provider === 'PAYFLOW_STRIPE' ? 'Stripe' : 'Wix';
  const squareConfigured = environmentConfigured[environment];

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>{t('Paiements', 'Payments')}</h2>
          <p style={{ color: '#64748b', marginBottom: 0, maxWidth: 760 }}>
            {t(
              'Square est le fournisseur PayFlow prioritaire. Le flux de paiement réel demeure Wix jusqu’à l’activation explicite des paiements PayFlow.',
              'Square is the primary PayFlow provider. The live payment flow remains on Wix until PayFlow payments are explicitly activated.',
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
              <option value="PAYFLOW_SQUARE">PayFlow · Square</option>
              <option value="PAYFLOW_STRIPE" disabled>{t('PayFlow · Stripe — futur', 'PayFlow · Stripe — future')}</option>
            </select>
          </label>

          {provider !== 'WIX' && <label>
            <span style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{t('Environnement', 'Environment')}</span>
            <select style={input} value={environment} onChange={(e) => setEnvironment(e.target.value as PaymentEnvironment)}>
              <option value="TEST">{t('Sandbox — aucune vraie transaction', 'Sandbox — no real transactions')}</option>
              <option value="LIVE">{t('Production — transactions réelles', 'Production — real transactions')}</option>
            </select>
          </label>}
        </div>

        {provider === 'PAYFLOW_SQUARE' && <div style={{ marginTop: 20, background: '#f8fafc', borderRadius: 10, padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
            <Info label={t('Compte Square', 'Square account')} value={maskedPaymentAccountId(paymentAccount.accountId)} />
            <Info label={t('Statut', 'Status')} value={statusLabel(derivedStatus)} />
            <Info label={t('Paiements', 'Payments')} value={paymentAccount.chargesEnabled ? t('Activés', 'Enabled') : t('Non activés', 'Not enabled')} />
            <Info label={t('Compte marchand', 'Merchant account')} value={paymentAccount.detailsSubmitted ? t('Actif', 'Active') : t('À vérifier', 'Needs verification')} />
            <Info label={t('Pays', 'Country')} value={paymentAccount.country || '—'} />
            <Info label={t('Dernière synchro', 'Last sync')} value={formatDate(paymentAccount.lastSyncedAt)} />
          </div>

          {(currentlyDue.length > 0 || pastDue.length > 0 || pendingVerification.length > 0) && <div style={{ marginTop: 14, fontSize: 13, color: '#475569' }}>
            {t('État du fournisseur', 'Provider state')}: {currentlyDue.length} {t('élément(s) actuel(s)', 'current item(s)')}, {pastDue.length} {t('bloquant(s)', 'blocking')}, {pendingVerification.length} {t('en attente', 'pending')}.
          </div>}

          <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{t('URL de retour Square', 'Square redirect URL')}</div>
            <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, overflowWrap: 'anywhere' }}>
              {callbackUrl || '—'}
            </div>
            {!callbackIsHttps && <div style={{ marginTop: 8, color: '#92400e', fontSize: 13 }}>
              {t(
                'Le serveur local ne peut pas servir de callback Square pour RentalFlow. Lancez npm run build puis npm run preview et utilisez l’URL HTTPS affichée dans cette section.',
                'The local server cannot be the Square callback for RentalFlow. Run npm run build then npm run preview and use the HTTPS URL shown in this section.',
              )}
            </div>}
            {callbackIsHttps && <div style={{ marginTop: 8, color: '#475569', fontSize: 13 }}>
              {t('Copiez exactement cette URL dans Square Developer Console → OAuth → Redirect URL.', 'Copy this exact URL into Square Developer Console → OAuth → Redirect URL.')}
            </div>}
          </div>

          {!squareConfigured && <div style={{ marginTop: 14, background: '#fff7ed', color: '#9a3412', borderRadius: 8, padding: 12, fontSize: 13 }}>
            {t(
              `Les identifiants Square ${environment === 'TEST' ? 'Sandbox' : 'Production'} ne sont pas encore configurés sur le serveur Wix.`,
              `Square ${environment === 'TEST' ? 'Sandbox' : 'Production'} credentials are not configured on the Wix server yet.`,
            )}
          </div>}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            {authorizeUrl ? <a
              href={authorizeUrl}
              target="rentalflow-square-oauth"
              rel="opener"
              style={{ ...primary, display: 'inline-block', textDecoration: 'none' }}
              onClick={() => {
                setError('');
                setSuccess(t('Ouverture de Square…', 'Opening Square…'));
              }}
            >
              {paymentAccount.accountId ? t('Reconnecter Square', 'Reconnect Square') : t('Connecter Square', 'Connect Square')}
            </a> : <button
              style={{ ...primary, opacity: .55 }}
              disabled
            >
              {connecting ? t('Préparation de Square…', 'Preparing Square…') : t('Connecter Square', 'Connect Square')}
            </button>}
            {paymentAccount.accountId && <button
              style={{ ...secondary, opacity: refreshing ? .55 : 1 }}
              disabled={refreshing}
              onClick={() => void refreshSquare()}
            >
              {refreshing ? t('Actualisation…', 'Refreshing…') : t('Actualiser le statut', 'Refresh status')}
            </button>}
          </div>

          <div style={{ marginTop: 12, color: '#64748b', fontSize: 12 }}>
            {t(
              'Les jetons OAuth Square sont chiffrés côté serveur. RentalFlow ne stocke aucun mot de passe Square, numéro de carte ou donnée bancaire.',
              'Square OAuth tokens are encrypted server-side. RentalFlow stores no Square password, card number, or bank data.',
            )}
          </div>
        </div>}

        {provider !== 'WIX' && provider !== 'PAYFLOW_SQUARE' && <div style={{ marginTop: 20, background: '#f8fafc', borderRadius: 10, padding: 16 }}>
          <Info label={t(`Compte ${providerName}`, `${providerName} account`)} value={maskedPaymentAccountId(accountForDisplay.payflowAccountId as string | undefined)} />
          <div style={{ marginTop: 10, color: '#64748b', fontSize: 13 }}>{t('Cette intégration est conservée pour une version future.', 'This integration is preserved for a future version.')}</div>
        </div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button style={{ ...primary, opacity: saving ? .6 : 1 }} disabled={saving} onClick={() => void save()}>
            {saving ? t('Enregistrement…', 'Saving…') : t('Enregistrer les paiements', 'Save payment settings')}
          </button>
        </div>
      </>}
    </div>
  );
};

const Info: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div style={{ color: '#64748b', fontSize: 12 }}>{label}</div>
    <div style={{ fontWeight: 700, marginTop: 4, overflowWrap: 'anywhere' }}>{value}</div>
  </div>
);

export default PaymentSettingsPanel;
