import { extensions } from '@wix/astro/builders';

export default extensions.dashboardPage({
  id: 'c5635248-110a-4f29-aeee-a84bfaee3a91',
  title: 'Réservations',
  routePath: 'reservations',
  component: './extensions/dashboard/pages/reservations/reservations.tsx',
  fullPage: false,
});
