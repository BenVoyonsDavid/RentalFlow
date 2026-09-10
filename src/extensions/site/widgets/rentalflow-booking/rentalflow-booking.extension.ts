import { extensions } from '@wix/astro/builders';

export default extensions.customElement({
  id: 'fe5716d4-b8e1-42fe-99c4-db1d652302c2',
  name: 'RentalFlow Online Booking',
  tagName: 'rentalflow-booking',
  element: './extensions/site/widgets/rentalflow-booking/rentalflow-booking.tsx',
  width: {
    defaultWidth: 980,
    allowStretch: true,
    stretchByDefault: true,
  },
  height: {
    defaultHeight: 940,
  },
  presets: [
    {
      id: '50de07f4-e873-474e-b979-286d1956a5a7',
      name: 'Réservation RentalFlow',
      thumbnailUrl: '{{BASE_URL}}/public/rentalflow-booking.svg',
    },
  ],
});
