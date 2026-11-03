import { extensions } from '@wix/astro/builders';
import type { DashboardSearchPageOptions } from '../../../../lib/dashboard-search-metadata';

export default extensions.dashboardPage({
  id: 'f0e7d3d2-6d68-4575-a8f3-4d6dd08eb2b7',
  title: 'Catalogue',
  routePath: 'catalog',
  component: './extensions/dashboard/pages/catalog/catalog.localized.tsx',
  fullPage: false,
  metaData: {
    searchable: true,
    title: "Catalogue",
    description: "Gérer le catalogue des produits, services et accessoires offerts à la location.",
  },
} as DashboardSearchPageOptions);
