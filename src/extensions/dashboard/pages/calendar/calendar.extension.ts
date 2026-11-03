import { extensions } from '@wix/astro/builders';

export default extensions.dashboardPage({
  id: 'b4a6d293-4fae-4fb7-a7d8-907e7d7f42b1',
  title: 'Calendrier',
  routePath: 'calendar',
  component: './extensions/dashboard/pages/calendar/calendar.localized.tsx',
  fullPage: false,
  metaData: {
    searchable: true,
    title: "Calendrier",
    description: "Consulter le calendrier des locations, réservations et disponibilités des équipements.",
  },
});
