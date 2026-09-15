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

const PAYMENT_ACCOUNTS = '@pilotedavid1/rental-flow/payment-accounts';

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

type PaymentAccountRecord = {
  _id?: string;
  settingsKey?: string;
  provider?: string;
  environment?: string;
  accountId?: string;
  accountStatus?: string;
  detailsSubmitted?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  requirementsCurrentlyDueJson?: string;
  requirementsPastDueJson?: string;
  requirementsPendingVerificationJson?: string;
  country?: string;
  defaultCurrency?: string;
  lastSyncedAt?: Date | string;
  active?: boolean;
};

const emptyRecord: PaymentAccountRecord = {
  settingsKey: 'default',
  provider: 'WIX',
  environment: 'TEST',
  accountStatus: 'NOT_CONNECTED',
  detailsSubmitted: false,
  chargesEnabled: false,
  payoutsEnabled: false,
  requirementsCurrentlyDueJson: '[]',
  requirementsPastDueJson: '[]',
  requirementsPendingVerificationJson: '[]',
  active: true,
};

const PaymentSettingsPanel: FC = () => {
  const { t, locale } = useRentalFlowI18n('dashboard');
  const [record, setRecord] = useState<PaymentAccountRecord>(emptyRecord);
  const [provider, setProvider] = useState<PaymentProvider>('WIX');
  const [environment, setEnvironment] = useState<PaymentEnvironment>('TEST');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await items.query(PAYMENT_ACCOUNTS).eq('settingsKey', 'default').limit(1).find();
        const existing = (result.items?.[0] as PaymentAccountRecord | undefined) || emptyRecord;
        if (!active) return;
        setRecord(existing);
        setProvider(normalizePaymentProvider(existing.provider));
        setEnvironment(normalizePaymentEnvironment(existing.environment));
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : t('Impossible de charger les paramètres de paiement.', 'Unable to load payment settings.'));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [t]);

  const derivedStatus = useMemo<PaymentAccountStatus>(() => paymentAccountStatus({ ...record, provider, environment }), [record, provider, environment]);
  const currentlyDue = decodeStringList(record.requirementsCurrentlyDueJson);
  const pastDue = decodeStringList(record.requirementsPastDueJson);
  const pendingVerification = decodeStringList(record.requirementsPendingVerificationJson);

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

  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const environmentChanged = normalizePaymentEnvironment(record.environment) !== environment;
      const clearProviderAccount = environmentChanged && Boolean(record.accountId);
      const payload: PaymentAccountRecord = {
        settingsKey: 'default',
        provider,
        environment,
        accountId: clearProviderAccount ? '' : record.accountId || '',
        accountStatus: clearProviderAccount ? 'NOT_CONNECTED' : record.accountStatus || 'NOT_CONNECTED',
        detailsSubmitted: clearProviderAccount ? false : record.detailsSubmitted === true,
        chargesEnabled: clearProviderAccount ? false : record.chargesEnabled === true,
        payoutsEnabled: clearProviderAccount ? false : record.payoutsEnabled === true,
        requirementsCurrentlyDueJson: clearProviderAccount ? '[]' : record.requirementsCurrentlyDueJson || '[]',
        requirementsPastDueJson: clearProviderAccount ? '[]' : record.requirementsPastDueJson || '[]',
        requirementsPendingVerificationJson: clearProviderAccount ? '[]' : record.requirementsPendingVerificationJson || '[]',
        country: clearProviderAccount ? '' : record.country || '',
        defaultCurrency: clearProviderAccount ? '' : record.defaultCurrency || '',
        lastSyncedAt: clearProviderAccount ? undefined : record.lastSyncedAt,
        active: true,
      };

      let saved: PaymentAccountRecord;
      if (record._id) saved = await items.update(PAYMENT_ACCOUNTS, { _id: record._id, ...payload }) as PaymentAccountRecord;
      else saved = await items.insert(PAYMENT_ACCOUNTS, payload) as PaymentAccountRecord;

      setRecord(saved);
      setProvider(normalizePaymentProvider(saved.provider));
      setEnvironment(normalizePaymentEnvironment(saved.environment));
      setSuccess(t('Paramètres de paiement enregistrés.', 'Payment settings saved.'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Impossible d’enregistrer les paramètres de paiement.', 'Unable to save payment settings.'));
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (value?: Date | string) => {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (!date.getTime()) return '—';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>{t('Paiements', 'Payments')}</h2>
          <p style={{ color: '#64748b', marginBottom: 0, maxWidth: 760 }}>
            {t(
              'Choisissez comment RentalFlow encaissera les paiements. Wix demeure le fournisseur par défaut jusqu’à ce qu’un compte PayFlow Stripe soit entièrement configuré.',
              'Choose how RentalFlow collects payments. Wix remains the default provider until a PayFlow Stripe account is fully configured.',
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
            <Info label={t('Compte Stripe', 'Stripe account')} value={maskedPaymentAccountId(record.accountId)} />
            <Info label={t('Statut', 'Status')} value={statusLabel(derivedStatus)} />
            <Info label={t('Paiements', 'Payments')} value={record.chargesEnabled ? t('Activés', 'Enabled') : t('Non activés', 'Not enabled')} />
            <Info label={t('Versements', 'Payouts')} value={record.payoutsEnabled ? t('Activés', 'Enabled') : t('Non activés', 'Not enabled')} />
            <Info label={t('Pays', 'Country')} value={record.country || '—'} />
            <Info label={t('Dernière synchro', 'Last sync')} value={formatDate(record.lastSyncedAt)} />
          </div>

          {(currentlyDue.length > 0 || pastDue.length > 0 || pendingVerification.length > 0) && <div style={{ marginTop: 14, fontSize: 13, color: '#475569' }}>
            {t('Exigences Stripe', 'Stripe requirements')}: {currentlyDue.length} {t('actuelle(s)', 'currently due')}, {pastDue.length} {t('en retard', 'past due')}, {pendingVerification.length} {t('en vérification', 'pending verification')}.
          </div>}

          {!record.accountId && <div style={{ marginTop: 14, color: '#475569', fontSize: 13 }}>
            {t(
              'La connexion Stripe Connect sera activée à la prochaine sous-étape. Aucune clé secrète, donnée bancaire ou donnée de carte ne sera stockée dans RentalFlow.',
              'Stripe Connect onboarding will be enabled in the next sub-step. No secret key, bank data, or card data will be stored in RentalFlow.',
            )}
          </div>}
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
