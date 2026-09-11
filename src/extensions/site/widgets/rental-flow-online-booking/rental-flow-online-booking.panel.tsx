import { t, getLocale } from '../../../../lib/i18n';
import { LanguageSelector, useLanguage } from '../../../../lib/i18n/react';
import React, { type FC, useCallback, useEffect, useState } from 'react';
import { httpClient } from '@wix/essentials';
import {
  SidePanel,
  WixDesignSystemProvider,
  SectionHelper,
} from '@wix/design-system';
import '@wix/design-system/styles.global.css';

type CallResult = {
  status?: number;
  body?: string;
  error?: string;
};

type DiagnosticState = {
  loading: boolean;
  moduleOrigin?: string;
  endpointUrl?: string;
  plain?: CallResult;
  authenticated?: CallResult;
};

async function readResponse(response: Response): Promise<CallResult> {
  const body = await response.text().catch(() => '');
  return {
    status: response.status,
    body: body || t("(réponse vide)"),
  };
}

const Panel: FC = () => {
  const language = useLanguage();
  const [diagnostic, setDiagnostic] = useState<DiagnosticState>({ loading: true });

  const runDiagnostic = useCallback(async () => {
    const moduleOrigin = new URL(import.meta.url).origin;
    const endpointUrl = `${moduleOrigin}/api/public-booking`;
    setDiagnostic({ loading: true, moduleOrigin, endpointUrl });

    let plain: CallResult;
    try {
      plain = await readResponse(await fetch(endpointUrl));
    } catch (error) {
      plain = {
        error: error instanceof Error ? error.message : String(error),
      };
    }

    let authenticated: CallResult;
    try {
      authenticated = await readResponse(await httpClient.fetchWithAuth(endpointUrl));
    } catch (error) {
      authenticated = {
        error: error instanceof Error ? error.message : String(error),
      };
    }

    setDiagnostic({
      loading: false,
      moduleOrigin,
      endpointUrl,
      plain,
      authenticated,
    });
  }, []);

  useEffect(() => {
    void runDiagnostic();
  }, [runDiagnostic]);

  return (
    <WixDesignSystemProvider>
      <div lang={language}>
      <LanguageSelector />
      <SidePanel width="380" height="100vh">
        <SidePanel.Content noPadding stretchVertically>
          <SidePanel.Field>
            <SectionHelper fullWidth appearance="success">
              {" " + t("Le nom de l’entreprise, le logo, les taxes, le dépôt et les modèles utilisés par ce widget se configurent dans Paramètres → RentalFlow.") + " "}</SectionHelper>
          </SidePanel.Field>

          <SidePanel.Field>
            <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.45 }}>
              <strong>{t("Diagnostic de connexion")}</strong>
              {diagnostic.loading ? <div style={{ marginTop: 8 }}>{t("Test en cours…")}</div> : null}

              {!diagnostic.loading ? (
                <>
                  <div style={{ marginTop: 10 }}><strong>{t("Origine du module")}</strong></div>
                  <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{diagnostic.moduleOrigin || t("(vide)")}</pre>

                  <div style={{ marginTop: 10 }}><strong>{t("URL de l’endpoint")}</strong></div>
                  <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{diagnostic.endpointUrl || t("(vide)")}</pre>

                  <div style={{ marginTop: 10 }}><strong>{t("1. fetch() sans authentification")}</strong></div>
                  <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 180, overflow: 'auto' }}>
                    {diagnostic.plain?.error
                      ? t("ERREUR: {0}", { 0: diagnostic.plain.error })
                      : `HTTP ${diagnostic.plain?.status ?? '—'}\n${diagnostic.plain?.body || ''}`}
                  </pre>

                  <div style={{ marginTop: 10 }}><strong>2. fetchWithAuth()</strong></div>
                  <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 220, overflow: 'auto' }}>
                    {diagnostic.authenticated?.error
                      ? t("ERREUR: {0}", { 0: diagnostic.authenticated.error })
                      : `HTTP ${diagnostic.authenticated?.status ?? '—'}\n${diagnostic.authenticated?.body || ''}`}
                  </pre>
                </>
              ) : null}

              <button
                type="button"
                onClick={() => void runDiagnostic()}
                style={{ marginTop: 10, padding: '8px 12px', cursor: 'pointer' }}
              >
                {" " + t("Relancer le test") + " "}</button>
            </div>
          </SidePanel.Field>
        </SidePanel.Content>
      </SidePanel>
    </div>
    </WixDesignSystemProvider>
  );
};

export default Panel;
