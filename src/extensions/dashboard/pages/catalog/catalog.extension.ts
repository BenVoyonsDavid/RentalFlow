import { extensions } from '@wix/astro/builders';

export default extensions.dashboardPage({
  id: 'f0e7d3d2-6d68-4575-a8f3-4d6dd08eb2b7',
  title: 'Catalogue',
  routePath: 'catalog',
  component: './extensions/dashboard/pages/catalog/catalog.tsx',
  fullPage: false,
});
