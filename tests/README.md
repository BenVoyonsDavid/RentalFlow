# Booking design regression checks

Run from the repository root:

```sh
npm install
npx playwright install chromium
npm run test:booking-design
npx tsc --noEmit
```

For an existing Chromium installation, set `CHROMIUM_PATH=/absolute/path/to/chromium`.

The browser test bundles the actual exported widget (including extras, finance and localization runtime layers) and appearance editor. It substitutes Wix authentication and serves fixture API responses on localhost. It checks date range selection and invalidation, required extras, deposit and offline submissions, French/English, narrow embedded layouts, theme validation/contrast, preset selection, HEX editing, preview and reset. Screenshots are written to a temporary directory printed by the test.

These checks do not make real reservations, charge payments or publish to Wix. Before release, validate settings persistence and the CMS schema update in the Wix test installation, then verify the widget on a published merchant site. The theme is stored in `app-settings.bookingThemeJson`; missing or invalid values fall back to the default palette. Each site uses its own settings record.
