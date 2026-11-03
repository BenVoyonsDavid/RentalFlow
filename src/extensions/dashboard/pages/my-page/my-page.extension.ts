import { extensions } from '@wix/astro/builders';

export default extensions.dashboardPage({
  id: '4e66043b-5a38-4a75-a93f-cf1fa15d4ff7',
  title: 'Tableau de bord',
  routePath: '',
  component: './extensions/dashboard/pages/my-page/my-page.localized.tsx',
  fullPage: false,
  metaData: {
    searchable: true,
    title: "Tableau de bord",
    description: "Suivre les locations à venir, les départs, les retours et les opérations quotidiennes.",
  },
});
