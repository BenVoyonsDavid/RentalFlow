import { extensions } from '@wix/astro/builders';

export default extensions.dashboardPage({
  id: '52d1588d-fc70-441a-aba5-dc65a48e07f4',
  title: 'Équipements',
  routePath: 'equipment',
  component: './extensions/dashboard/pages/equipment/equipment.localized.tsx',
  fullPage: false,
});
