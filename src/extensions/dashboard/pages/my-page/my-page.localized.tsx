import { useEffect } from 'react';
import { items } from '@wix/data';
import DashboardPage from './my-page';
import { withDashboardLocalization } from '../../../../intl/dashboard-page';
import { sendRentalFlowBiEvent } from '../../../../lib/bi-events-client';

const ASSETS = '@pilotedavid1/rental-flow/assets';
const LocalizedDashboardPage = withDashboardLocalization(DashboardPage);

// APP_FINISHED_CONFIGURATION has an app-wide Wix side effect: after the app
// sends it once, new installations can show "Setup incomplete" until that
// instance also sends the event. Keep it opt-in until RentalFlow's onboarding
// UX is finalized and we explicitly decide to enable that status behavior.
const ENABLE_WIX_SETUP_INCOMPLETE_STATUS = false;

export default function TrackedDashboardPage() {
  useEffect(() => {
    void sendRentalFlowBiEvent({
      eventName: 'APP_DASHBOARD_LOADED',
      eventData: { page: 'overview' },
    });

    const reportSetupState = async () => {
      try {
        const result = await items.query(ASSETS).limit(100).find();
        const configured = result.items.some((item) => item.active !== false && item.status !== 'INACTIVE');
        if (!configured) return;

        await sendRentalFlowBiEvent({
          eventName: 'APP_SETUP_FINISHED',
          eventData: { reason: 'active_asset_exists' },
        });

        if (ENABLE_WIX_SETUP_INCOMPLETE_STATUS) {
          await sendRentalFlowBiEvent({
            eventName: 'APP_FINISHED_CONFIGURATION',
            eventData: { reason: 'active_asset_exists' },
          });
        }
      } catch (error) {
        console.warn('RentalFlow setup BI state could not be evaluated.', error);
      }
    };

    void reportSetupState();
  }, []);

  return <LocalizedDashboardPage />;
}
