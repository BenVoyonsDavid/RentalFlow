import type { CSSProperties, FC, FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { items } from '@wix/data';
import { Page, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import { getCurrentPlan, planLabels } from '../../../../lib/plans';

const SETTINGS = '@pilotedavid1/rental-flow/app-settings';
const TEMPLATES = '@pilotedavid1/rental-flow/document-templates';

type SettingsTab = 'GENERAL' | 'TAXES_PAYMENTS' | 'TEMPLATES' | 'PLANS';
type DocumentType = 'QUOTE' | 'CONTRACT' | 'INVOICE';
type DepositType = 'PERCENT' | 'FIXED';

type AppSettings = {
  _id?: string;
  settingsKey?: string;
  companyName?: string;
  logoUrl?: string;
  currency?: string;
  defaultBufferBeforeHours?: number;
  defaultBufferAfterHours?: number;
  taxesEnabled?: boolean;
  tax1Name?: string;
  tax1Rate?: number;
  tax2Name?: string;
  tax2Rate?: number;
  tax2Compound?: boolean;
  defaultDepositEnabled?: boolean;
  defaultDepositType?: DepositType;
  defaultDepositValue?: number;
  defaultQuoteTemplateId?: string;
  defaultContractTemplateId?: string;
  defaultInvoiceTemplateId?: string;
  paymentProvider?: string;
  active?: boolean;
};

type DocumentTemplate = {
  _id?: string;
  name?: string;
  documentType?: DocumentType;
  logoUrl?: string;
  titleText?: string;
  introText?: string;
  termsText?: string;
  footerText?: string;
  requiredFieldsCsv?: string;
  active?: boolean;
};

type TemplateForm = {
  name: string;
  documentType: DocumentType;
  logoUrl: string;
  titleText: string;
  introText: string;
  termsText: string;
  footerText: string;
  requiredFields: string[];
};

const requiredFieldOptions = [
  { key: 'CUSTOMER_NAME', label: 'Nom du client' },
  { key: 'CUSTOMER_EMAIL', label: 'Courriel du client' },
  { key: 'CUSTOMER_PHONE', label: 'Téléphone du client' },
  { key: 'CUSTOMER_ADDRESS', label: 'Adresse complète du client' },
  { key: 'RENTAL_DATES', label: 'Dates de location' },
  { key: 'EQUIPMENT', label: 'Au moins un équipement' },
];

const blankTemplate: TemplateForm = {
  name: '',
  documentType: 'QUOTE',
  logoUrl: '',
  titleText: '',
  introText: '',
  termsText: '',
  footerText: '',
  requiredFields: ['CUSTOMER_NAME', 'RENTAL_DATES', 'EQUIPMENT'],
};

const defaultSettings: AppSettings = {
  settingsKey: 'default',
  companyName: '',
  logoUrl: '',
  currency: 'CAD',
  defaultBufferBeforeHours: 0,
  defaultBufferAfterHours: 0,
  taxesEnabled: true,
  tax1Name: 'TPS',
  tax1Rate: 5,
  tax2Name: 'TVQ',
  tax2Rate: 9.975,
  tax2Compound: false,
  defaultDepositEnabled: false,
  defaultDepositType: 'PERCENT',
  defaultDepositValue: 25,
  defaultQuoteTemplateId: '',
  defaultContractTemplateId: '',
  defaultInvoiceTemplateId: '',
  paymentProvider: 'WIX',
  active: true,
};

const card: CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
  padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.06)',
};
const primary: CSSProperties = {
  border: 0, borderRadius: 8, padding: '10px 16px', fontSize: 14,
  fontWeight: 600, cursor: 'pointer', background: '#116dff', color: '#fff',
};
const secondary: CSSProperties = {
  ...primary, border: '1px solid #116dff', background: '#fff', color: '#116dff',
};
const danger: CSSProperties = { ...secondary, borderColor: '#dc2626', color: '#b91c1c' };
const input: CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1',
  borderRadius: 8, padding: '10px 12px', fontSize: 14, background: '#fff',
};

function numberValue(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function typeLabel(type?: DocumentType): string {
  return type === 'CONTRACT' ? 'Contrat' : type === 'INVOICE' ? 'Facture' : 'Devis';
}

const SettingsV2Page: FC = () => {
  const plan = getCurrentPlan();
  const [tab, setTab] = useState<SettingsTab>('GENERAL');
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateForm>(blankTemplate);
  const [templateError, setTemplateError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [settingsResult, templateResult] = await Promise.all([
        items.query(SETTINGS).eq('settingsKey', 'default').limit(1).find(),
        items.query(TEMPLATES).limit(100).find(),
      ]);
      const saved = settingsResult.items[0] as AppSettings | undefined;
      setSettings({ ...defaultSettings, ...(saved || {}) });
      setTemplates(templateResult.items as DocumentTemplate[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les paramètres.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeTemplates = useMemo(
    () => templates.filter((template) => template.active !== false),
    [templates]
  );

  const saveSettings = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload = {
        ...settings,
        settingsKey: 'default',
        defaultBufferBeforeHours: numberValue(settings.defaultBufferBeforeHours),
        defaultBufferAfterHours: numberValue(settings.defaultBufferAfterHours),
        tax1Rate: numberValue(settings.tax1Rate),
        tax2Rate: numberValue(settings.tax2Rate),
        defaultDepositValue: numberValue(settings.defaultDepositValue),
        paymentProvider: 'WIX',
        active: true,
      };
      if (settings._id) {
        const updated = await items.update(SETTINGS, payload) as AppSettings;
        setSettings({ ...defaultSettings, ...updated });
      } else {
        const created = await items.insert(SETTINGS, payload) as AppSettings;
        setSettings({ ...defaultSettings, ...created });
      }
      setSuccess('Paramètres enregistrés. Les nouvelles réservations utiliseront ces valeurs par défaut.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d’enregistrer les paramètres.');
    } finally {
      setSaving(false);
    }
  };

  const openNewTemplate = (documentType: DocumentType) => {
    const defaults: Record<DocumentType, Partial<TemplateForm>> = {
      QUOTE: { titleText: 'Devis de location', introText: 'Voici votre proposition de location.' },
      CONTRACT: { titleText: 'Contrat de location', introText: 'Le présent contrat confirme les conditions de la location.' },
      INVOICE: { titleText: 'Facture', introText: 'Merci pour votre confiance.' },
    };
    setEditingTemplate(null);
    setTemplateForm({ ...blankTemplate, documentType, logoUrl: settings.logoUrl || '', ...defaults[documentType] });
    setTemplateError('');
    setTemplateOpen(true);
  };

  const openEditTemplate = (template: DocumentTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name || '',
      documentType: template.documentType || 'QUOTE',
      logoUrl: template.logoUrl || '',
      titleText: template.titleText || '',
      introText: template.introText || '',
      termsText: template.termsText || '',
      footerText: template.footerText || '',
      requiredFields: (template.requiredFieldsCsv || '').split(',').map((v) => v.trim()).filter(Boolean),
    });
    setTemplateError('');
    setTemplateOpen(true);
  };

  const saveTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setTemplateError('');
    if (!templateForm.name.trim()) return setTemplateError('Le nom du modèle est obligatoire.');
    if (!templateForm.titleText.trim()) return setTemplateError('Le titre du document est obligatoire.');
    if (templateForm.requiredFields.length === 0) return setTemplateError('Sélectionnez au moins un champ obligatoire.');
    setSaving(true);
    try {
      const payload: DocumentTemplate = {
        name: templateForm.name.trim(),
        documentType: templateForm.documentType,
        logoUrl: templateForm.logoUrl.trim(),
        titleText: templateForm.titleText.trim(),
        introText: templateForm.introText.trim(),
        termsText: templateForm.termsText.trim(),
        footerText: templateForm.footerText.trim(),
        requiredFieldsCsv: templateForm.requiredFields.join(','),
        active: editingTemplate?.active !== false,
      };
      if (editingTemplate?._id) {
        await items.update(TEMPLATES, { _id: editingTemplate._id, ...payload });
      } else {
        await items.insert(TEMPLATES, payload);
      }
      setTemplateOpen(false); setEditingTemplate(null); setTemplateForm(blankTemplate);
      setSuccess('Modèle de document enregistré.');
      await load();
    } catch (e) {
      setTemplateError(e instanceof Error ? e.message : 'Impossible d’enregistrer le modèle.');
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (template: DocumentTemplate) => {
    if (!template._id) return;
    if (!window.confirm(`Supprimer le modèle « ${template.name || typeLabel(template.documentType)} » ?`)) return;
    try {
      await items.remove(TEMPLATES, template._id);
      const next = { ...settings };
      if (next.defaultQuoteTemplateId === template._id) next.defaultQuoteTemplateId = '';
      if (next.defaultContractTemplateId === template._id) next.defaultContractTemplateId = '';
      if (next.defaultInvoiceTemplateId === template._id) next.defaultInvoiceTemplateId = '';
      setSettings(next);
      setSuccess('Modèle supprimé. Enregistrez les paramètres si ce modèle était utilisé par défaut.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de supprimer le modèle.');
    }
  };

  const toggleRequired = (key: string) => {
    setTemplateForm((current) => ({
      ...current,
      requiredFields: current.requiredFields.includes(key)
        ? current.requiredFields.filter((field) => field !== key)
        : [...current.requiredFields, key],
    }));
  };

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header title="Paramètres" subtitle="Configurez RentalFlow, les taxes, les paiements et vos documents." />
        <Page.Content>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 50 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <TabButton active={tab === 'GENERAL'} onClick={() => setTab('GENERAL')}>Général</TabButton>
              <TabButton active={tab === 'TAXES_PAYMENTS'} onClick={() => setTab('TAXES_PAYMENTS')}>Taxes & paiements</TabButton>
              <TabButton active={tab === 'TEMPLATES'} onClick={() => setTab('TEMPLATES')}>Modèles de documents</TabButton>
              <TabButton active={tab === 'PLANS'} onClick={() => setTab('PLANS')}>Abonnement</TabButton>
            </div>

            {error && <div style={{ ...card, borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div>}
            {success && <div style={{ ...card, borderColor: '#86efac', background: '#f0fdf4', color: '#166534' }}>{success}</div>}
            {loading ? <div style={card}>Chargement…</div> : null}

            {!loading && tab === 'GENERAL' && (
              <div style={card}>
                <h2 style={{ marginTop: 0 }}>Entreprise et opérations</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
                  <Field label="Nom de l’entreprise"><input style={input} value={settings.companyName || ''} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} /></Field>
                  <Field label="Logo (URL)"><input style={input} value={settings.logoUrl || ''} onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })} placeholder="https://…" /></Field>
                  <Field label="Devise par défaut"><select style={input} value={settings.currency || 'CAD'} onChange={(e) => setSettings({ ...settings, currency: e.target.value })}><option value="CAD">CAD</option><option value="USD">USD</option><option value="EUR">EUR</option></select></Field>
                  <Field label="Buffer avant par défaut (heures)"><input type="number" min="0" step="0.5" style={input} value={settings.defaultBufferBeforeHours ?? 0} onChange={(e) => setSettings({ ...settings, defaultBufferBeforeHours: numberValue(e.target.value) })} /></Field>
                  <Field label="Buffer après par défaut (heures)"><input type="number" min="0" step="0.5" style={input} value={settings.defaultBufferAfterHours ?? 0} onChange={(e) => setSettings({ ...settings, defaultBufferAfterHours: numberValue(e.target.value) })} /></Field>
                </div>
                {settings.logoUrl ? <div style={{ marginTop: 18 }}><div style={{ color: '#64748b', fontSize: 13, marginBottom: 8 }}>Aperçu du logo</div><img src={settings.logoUrl} alt="Logo" style={{ maxWidth: 220, maxHeight: 100, objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }} /></div> : null}
                <SaveButton saving={saving} onClick={() => void saveSettings()} />
              </div>
            )}

            {!loading && tab === 'TAXES_PAYMENTS' && (
              <>
                <div style={card}>
                  <h2 style={{ marginTop: 0 }}>Taxes</h2>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><input type="checkbox" checked={settings.taxesEnabled !== false} onChange={(e) => setSettings({ ...settings, taxesEnabled: e.target.checked })} /> Appliquer les taxes aux nouvelles réservations</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 16, opacity: settings.taxesEnabled === false ? .5 : 1 }}>
                    <Field label="Taxe 1"><input disabled={settings.taxesEnabled === false} style={input} value={settings.tax1Name || ''} onChange={(e) => setSettings({ ...settings, tax1Name: e.target.value })} placeholder="TPS" /></Field>
                    <Field label="Taux taxe 1 (%)"><input disabled={settings.taxesEnabled === false} type="number" min="0" step="0.001" style={input} value={settings.tax1Rate ?? 0} onChange={(e) => setSettings({ ...settings, tax1Rate: numberValue(e.target.value) })} /></Field>
                    <Field label="Taxe 2"><input disabled={settings.taxesEnabled === false} style={input} value={settings.tax2Name || ''} onChange={(e) => setSettings({ ...settings, tax2Name: e.target.value })} placeholder="TVQ" /></Field>
                    <Field label="Taux taxe 2 (%)"><input disabled={settings.taxesEnabled === false} type="number" min="0" step="0.001" style={input} value={settings.tax2Rate ?? 0} onChange={(e) => setSettings({ ...settings, tax2Rate: numberValue(e.target.value) })} /></Field>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, opacity: settings.taxesEnabled === false ? .5 : 1 }}><input disabled={settings.taxesEnabled === false} type="checkbox" checked={settings.tax2Compound === true} onChange={(e) => setSettings({ ...settings, tax2Compound: e.target.checked })} /> Calculer la taxe 2 sur le montant incluant la taxe 1</label>
                  <p style={{ color: '#64748b', fontSize: 13 }}>RentalFlow enregistre un snapshot des taxes sur chaque réservation et document. Modifier les taux plus tard ne changera donc pas les anciennes transactions.</p>
                </div>

                <div style={card}>
                  <h2 style={{ marginTop: 0 }}>Paiement et dépôt</h2>
                  <div style={{ padding: 14, borderRadius: 10, background: '#eff6ff', color: '#1e40af', marginBottom: 16 }}>
                    Les paiements en ligne seront effectués par le checkout / lien de paiement Wix. RentalFlow ne stocke jamais les numéros de carte.
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><input type="checkbox" checked={settings.defaultDepositEnabled === true} onChange={(e) => setSettings({ ...settings, defaultDepositEnabled: e.target.checked })} /> Demander un dépôt par défaut</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
                    <Field label="Type de dépôt"><select disabled={!settings.defaultDepositEnabled} style={input} value={settings.defaultDepositType || 'PERCENT'} onChange={(e) => setSettings({ ...settings, defaultDepositType: e.target.value as DepositType })}><option value="PERCENT">Pourcentage</option><option value="FIXED">Montant fixe</option></select></Field>
                    <Field label={settings.defaultDepositType === 'FIXED' ? 'Montant par défaut' : 'Pourcentage par défaut'}><input disabled={!settings.defaultDepositEnabled} type="number" min="0" step="0.01" style={input} value={settings.defaultDepositValue ?? 0} onChange={(e) => setSettings({ ...settings, defaultDepositValue: numberValue(e.target.value) })} /></Field>
                    <Field label="Fournisseur de paiement"><input style={input} value="Wix Payments / moyens de paiement Wix" disabled /></Field>
                  </div>
                  <p style={{ color: '#64748b', fontSize: 13 }}>Chaque réservation pourra remplacer ce réglage et choisir : paiement complet immédiatement, dépôt seulement, ou aucun paiement immédiat.</p>
                </div>
                <SaveButton saving={saving} onClick={() => void saveSettings()} />
              </>
            )}

            {!loading && tab === 'TEMPLATES' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div><h2 style={{ margin: 0 }}>Modèles de documents</h2><div style={{ color: '#64748b', marginTop: 5 }}>Créez plusieurs modèles et choisissez celui à utiliser dans chaque réservation.</div></div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button style={secondary} onClick={() => openNewTemplate('QUOTE')}>+ Devis</button><button style={secondary} onClick={() => openNewTemplate('CONTRACT')}>+ Contrat</button><button style={secondary} onClick={() => openNewTemplate('INVOICE')}>+ Facture</button></div>
                  </div>
                </div>

                <div style={card}>
                  <h3 style={{ marginTop: 0 }}>Modèles par défaut</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16 }}>
                    <TemplateSelect label="Devis par défaut" type="QUOTE" templates={activeTemplates} value={settings.defaultQuoteTemplateId || ''} onChange={(value) => setSettings({ ...settings, defaultQuoteTemplateId: value })} />
                    <TemplateSelect label="Contrat par défaut" type="CONTRACT" templates={activeTemplates} value={settings.defaultContractTemplateId || ''} onChange={(value) => setSettings({ ...settings, defaultContractTemplateId: value })} />
                    <TemplateSelect label="Facture par défaut" type="INVOICE" templates={activeTemplates} value={settings.defaultInvoiceTemplateId || ''} onChange={(value) => setSettings({ ...settings, defaultInvoiceTemplateId: value })} />
                  </div>
                  <SaveButton saving={saving} onClick={() => void saveSettings()} />
                </div>

                <div style={card}>
                  {activeTemplates.length === 0 ? <div style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>Aucun modèle. Utilisez + Devis, + Contrat ou + Facture.</div> : (
                    <div style={{ display: 'grid', gap: 12 }}>{activeTemplates.map((template) => (
                      <div key={template._id || template.name} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 15, display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div><strong>{template.name}</strong><div style={{ color: '#64748b', marginTop: 4 }}>{typeLabel(template.documentType)} · {(template.requiredFieldsCsv || '').split(',').filter(Boolean).length} champ(s) obligatoire(s)</div></div>
                        <div style={{ display: 'flex', gap: 8 }}><button style={secondary} onClick={() => openEditTemplate(template)}>Modifier</button><button style={danger} onClick={() => void deleteTemplate(template)}>Supprimer</button></div>
                      </div>
                    ))}</div>
                  )}
                </div>
              </div>
            )}

            {!loading && tab === 'PLANS' && (
              <div style={card}>
                <h2 style={{ marginTop: 0 }}>Abonnement</h2>
                <div style={{ fontSize: 18 }}>Plan actuel : <strong>{planLabels[plan]}</strong></div>
                <p style={{ color: '#64748b' }}>Pour la bêta privée, toutes les fonctions sont ouvertes afin de tester le flux complet. Avant l’App Market public, RentalFlow lira le vrai forfait Wix installé.</p>
                <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}><thead><tr style={{ textAlign: 'left', color: '#64748b' }}><th style={{ padding: 10 }}>Fonction</th><th>Gratuit</th><th>Starter</th><th>Business</th><th>Pro</th></tr></thead><tbody>
                  <PlanRow label="Réservations, buffers, calendrier mensuel" values={[true,true,true,true]} />
                  <PlanRow label="Tarifs hebdomadaires + documents" values={[false,true,true,true]} />
                  <PlanRow label="Paiements Wix et dépôt" values={[false,true,true,true]} />
                  <PlanRow label="Tarifs mensuels + rabais + inspections" values={[false,false,true,true]} />
                  <PlanRow label="Modèles avancés / historique complet" values={[false,false,true,true]} />
                  <PlanRow label="Inventaire illimité / automatisations avancées" values={[false,false,false,true]} />
                </tbody></table></div>
              </div>
            )}
          </div>
        </Page.Content>
      </Page>

      {templateOpen && (
        <div onMouseDown={() => !saving && setTemplateOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
          <div onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 900, maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 14 }}>
            <form onSubmit={saveTemplate}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><h2 style={{ margin: 0 }}>{editingTemplate ? 'Modifier le modèle' : `Nouveau modèle — ${typeLabel(templateForm.documentType)}`}</h2><div style={{ color: '#64748b', marginTop: 4 }}>Le contenu sera figé dans chaque document généré afin de préserver son historique.</div></div><button type="button" disabled={saving} onClick={() => setTemplateOpen(false)} style={{ border: 0, background: 'transparent', fontSize: 26 }}>×</button></div>
              <div style={{ padding: 24 }}>
                {templateError && <div style={{ background: '#fef2f2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 16 }}>{templateError}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
                  <Field label="Nom du modèle *"><input autoFocus style={input} value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="Ex. Contrat standard" /></Field>
                  <Field label="Type"><select style={input} value={templateForm.documentType} onChange={(e) => setTemplateForm({ ...templateForm, documentType: e.target.value as DocumentType })}><option value="QUOTE">Devis</option><option value="CONTRACT">Contrat</option><option value="INVOICE">Facture</option></select></Field>
                  <Field label="Logo (URL)"><input style={input} value={templateForm.logoUrl} onChange={(e) => setTemplateForm({ ...templateForm, logoUrl: e.target.value })} placeholder={settings.logoUrl || 'https://…'} /></Field>
                  <Field label="Titre du document *"><input style={input} value={templateForm.titleText} onChange={(e) => setTemplateForm({ ...templateForm, titleText: e.target.value })} /></Field>
                </div>
                <div style={{ marginTop: 16 }}><Field label="Texte d’introduction"><textarea style={{ ...input, minHeight: 90 }} value={templateForm.introText} onChange={(e) => setTemplateForm({ ...templateForm, introText: e.target.value })} /></Field></div>
                <div style={{ marginTop: 16 }}><Field label="Conditions / texte personnalisé"><textarea style={{ ...input, minHeight: 180 }} value={templateForm.termsText} onChange={(e) => setTemplateForm({ ...templateForm, termsText: e.target.value })} placeholder="Conditions de location, politique de dommages, modalités de paiement…" /></Field></div>
                <div style={{ marginTop: 16 }}><Field label="Pied de page"><textarea style={{ ...input, minHeight: 70 }} value={templateForm.footerText} onChange={(e) => setTemplateForm({ ...templateForm, footerText: e.target.value })} /></Field></div>
                <h3 style={{ marginTop: 24 }}>Champs obligatoires lors de la réservation</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>{requiredFieldOptions.map((option) => <label key={option.key} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, display: 'flex', gap: 9, alignItems: 'center' }}><input type="checkbox" checked={templateForm.requiredFields.includes(option.key)} onChange={() => toggleRequired(option.key)} /> {option.label}</label>)}</div>
              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button type="button" style={secondary} onClick={() => setTemplateOpen(false)} disabled={saving}>Annuler</button><button type="submit" style={primary} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le modèle'}</button></div>
            </form>
          </div>
        </div>
      )}
    </WixDesignSystemProvider>
  );
};

const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => <label style={{ display: 'block' }}><span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</span>{children}</label>;
const TabButton: FC<{ active: boolean; onClick: () => void; children: string }> = ({ active, onClick, children }) => <button onClick={onClick} style={{ ...secondary, background: active ? '#116dff' : '#fff', color: active ? '#fff' : '#116dff' }}>{children}</button>;
const SaveButton: FC<{ saving: boolean; onClick: () => void }> = ({ saving, onClick }) => <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}><button style={primary} disabled={saving} onClick={onClick}>{saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}</button></div>;
const PlanRow: FC<{ label: string; values: boolean[] }> = ({ label, values }) => <tr style={{ borderTop: '1px solid #e5e7eb' }}><td style={{ padding: 12, fontWeight: 600 }}>{label}</td>{values.map((value, index) => <td key={index} style={{ padding: 12 }}>{value ? '✓' : '—'}</td>)}</tr>;
const TemplateSelect: FC<{ label: string; type: DocumentType; templates: DocumentTemplate[]; value: string; onChange: (value: string) => void }> = ({ label, type, templates, value, onChange }) => <Field label={label}><select style={input} value={value} onChange={(e) => onChange(e.target.value)}><option value="">Aucun par défaut</option>{templates.filter((template) => template.documentType === type).map((template) => <option key={template._id} value={template._id}>{template.name}</option>)}</select></Field>;

export default SettingsV2Page;
