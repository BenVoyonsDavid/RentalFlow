import { extensions } from '@wix/astro/builders';

export default extensions.dashboardPage({
  id: 'da63679a-4145-4c0f-a391-5870f6809c36',
  title: 'Paramètres',
  routePath: 'settings',
  component: './extensions/dashboard/pages/settings/settings.localized.tsx',
  fullPage: false,
  metaData: {
    searchable: true,
    title: "Paramètres",
    description: "Configurer la société, les taxes, les paiements, la réservation en ligne et les modèles.",
  },
});
