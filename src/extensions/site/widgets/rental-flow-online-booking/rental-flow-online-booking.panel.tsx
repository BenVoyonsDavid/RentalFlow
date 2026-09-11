import React, { type FC, useCallback, useEffect, useState } from 'react';
import { httpClient } from '@wix/essentials';
import {
  SidePanel,
  WixDesignSystemProvider,
  SectionHelper,
} from '@wix/design-system';
import '@wix/design-system/styles.global.css';

type DiagnosticState = {
  loading: boolean;
  status?: number;
  body?: string;
  error?: string;
};

const Panel: FC = () => {
  const [diagnostic, setDiagnostic] = useState<DiagnosticState>({ loading: true });

  const runDiagnostic = useCallback(async () => {
    setDiagnostic({ loading: true });
    const url = `${import.meta.env.BASE_API_URL}/api/public-booking-debug`;

    try {
      const response = await httpClient.fetchWithAuth(url);
      const body = await response.text();
      setDiagnostic({
        loading: false,
        status: response.status,
        body,
      });
    } catch (error) {
      setDiagnostic({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  useEffect(() => {
    void runDiagnostic();
  }, [runDiagnostic]);

  return (
    <WixDesignSystemProvider>
      <SidePanel width="340" height="100vh">
        <SidePanel.Content noPadding stretchVertically>
          <SidePanel.Field>
            <SectionHelper fullWidth appearance="success">
              Le nom de l’entreprise, le logo, les taxes, le dépôt et les modèles utilisés par ce widget se configurent dans Paramètres → RentalFlow.
            </SectionHelper>
          </SidePanel.Field>

          <SidePanel.Field>
            <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.45 }}>
              <strong>Diagnostic de connexion</strong>
              <div style={{ marginTop: 8 }}>
                {diagnostic.loading ? 'Test en cours…' : `HTTP ${diagnostic.status ?? '—'}`}
              </div>
              {diagnostic.error ? (
                <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{diagnostic.error}</pre>
              ) : null}
              {diagnostic.body ? (
                <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 420, overflow: 'auto' }}>
                  {diagnostic.body}
                </pre>
              ) : null}
              <button
                type="button"
                onClick={() => void runDiagnostic()}
                style={{ marginTop: 10, padding: '8px 12px', cursor: 'pointer' }}
              >
                Relancer le test
              </button>
            </div>
          </SidePanel.Field>
        </SidePanel.Content>
      </SidePanel>
    </WixDesignSystemProvider>
  );
};

export default Panel;
