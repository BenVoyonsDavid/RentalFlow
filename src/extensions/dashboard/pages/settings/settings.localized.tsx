import SettingsPage from './settings-v2';
import { withDashboardLocalization } from '../../../../intl/dashboard-page';

// The dashboard localization wrapper also resolves/caches the installed Wix
// pricing package before legacy plan-aware settings are rendered.
export default withDashboardLocalization(SettingsPage, true);
