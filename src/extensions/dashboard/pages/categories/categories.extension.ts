import { extensions } from '@wix/astro/builders';

export default extensions.dashboardPage({
  id: '9a3dd83f-183e-45dc-843d-b2a9b93f9a14',
  title: 'Catégories',
  routePath: 'categories',
  component: './extensions/dashboard/pages/categories/categories.tsx',
  fullPage: false,
});
