import { app } from '@wix/astro/builders';
import dashboardPage from './extensions/dashboard/pages/my-page/my-page.extension.ts';
import equipmentPage from './extensions/dashboard/pages/equipment/equipment.extension.ts';
import reservationsPage from './extensions/dashboard/pages/reservations/reservations.extension.ts';
import customersPage from './extensions/dashboard/pages/customers/customers.extension.ts';
import settingsPage from './extensions/dashboard/pages/settings/settings.extension.ts';
import dataCollections from './extensions/backend/data-collections/data-collections.extension.ts';

export default app()
  .use(dashboardPage)
  .use(equipmentPage)
  .use(reservationsPage)
  .use(customersPage)
  .use(settingsPage)
  .use(dataCollections);
