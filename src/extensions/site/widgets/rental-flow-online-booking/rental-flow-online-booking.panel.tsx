import React, { type FC } from 'react';
import {
  SidePanel,
  WixDesignSystemProvider,
  SectionHelper,
} from '@wix/design-system';
import '@wix/design-system/styles.global.css';

const Panel: FC = () => (
  <WixDesignSystemProvider>
    <SidePanel width="300" height="100vh">
      <SidePanel.Content noPadding stretchVertically>
        <SidePanel.Field>
          <SectionHelper fullWidth appearance="success">
            Le nom de l’entreprise, le logo, les taxes, le dépôt et les modèles utilisés par ce widget se configurent dans Paramètres → RentalFlow.
          </SectionHelper>
        </SidePanel.Field>
      </SidePanel.Content>
    </SidePanel>
  </WixDesignSystemProvider>
);

export default Panel;
