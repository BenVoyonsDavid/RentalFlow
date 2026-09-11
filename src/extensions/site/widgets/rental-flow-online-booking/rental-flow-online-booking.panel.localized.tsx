import type { FC } from 'react';
import Panel from './rental-flow-online-booking.panel';
import { LocalizedScope, useRentalFlowI18n } from '../../../../intl';

const LocalizedPanel: FC = () => {
  const { language } = useRentalFlowI18n('site');
  return (
    <LocalizedScope language={language}>
      <Panel />
    </LocalizedScope>
  );
};

export default LocalizedPanel;
