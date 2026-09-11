import { extensions } from '@wix/astro/builders';

export default extensions.dashboardPage({
  id: 'aded2636-c1a8-48aa-ae81-db5264196ce4',
  title: 'Clients',
  routePath: 'customers',
  component: './extensions/dashboard/pages/customers/customers.localized.tsx',
  fullPage: false,
});
