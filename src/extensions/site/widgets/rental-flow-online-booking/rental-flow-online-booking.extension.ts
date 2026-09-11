import { extensions } from '@wix/astro/builders';

export default extensions.customElement({
  id: 'b3646620-b4ff-4238-9db8-2601c0929a34',
  name: 'RentalFlow Online Booking',
  width: {
    defaultWidth: 980,
    allowStretch: true,
    stretchByDefault: true,
  },
  height: {
    defaultHeight: 940,
  },
  installation: {
    autoAdd: true,
  },
  presets: [
    {
      id: 'c76f9552-dc23-49bb-b3c5-113e6a943e0e',
      name: 'Réservation RentalFlow',
      thumbnailUrl: '{{BASE_URL}}/rental-flow-online-booking-thumbnail.png',
    },
  ],
  tagName: 'rental-flow-online-booking',
  element: './extensions/site/widgets/rental-flow-online-booking/rental-flow-online-booking.runtime.tsx',
  settings: './extensions/site/widgets/rental-flow-online-booking/rental-flow-online-booking.panel.localized.tsx',
});
