import { extensions } from '@wix/astro/builders';

export default extensions.dashboardPage({
  id: '86a46867-2412-46ae-a0f3-b42bc31d5f75',
  title: 'Extras de réservation',
  routePath: 'reservation-extras',
  component: './extensions/dashboard/pages/reservation-extras/reservation-extras.localized.tsx',
  fullPage: false,
});
