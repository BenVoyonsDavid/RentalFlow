# Booking design regression checks

Run from the repository root:

```sh
npm install
npm run test:domain
npm run test:security
npm run test:journey
npm run test:management-ui
npx playwright install chromium
npm run test:booking-design
npm run typecheck
```

For an existing Chromium installation, set `CHROMIUM_PATH=/absolute/path/to/chromium`.

The domain test covers pricing, taxes, deposits, overlap rules, catalog pricing and compatibility without Wix or a browser.

The browser test bundles the actual exported widget (including extras, finance and localization runtime layers) and appearance editor. It substitutes Wix authentication and serves fixture API responses on localhost. It checks date range selection and invalidation, required extras, deposit and offline submissions, French/English, narrow embedded layouts, theme validation/contrast, preset selection, HEX editing, preview and reset. Screenshots are written to a temporary directory printed by the test.

These checks do not make real reservations, charge payments or publish to Wix. Before release, validate settings persistence and the CMS schema update in the Wix test installation, then verify the widget on a published merchant site. The theme is stored in `app-settings.bookingThemeJson`; missing or invalid values fall back to the default palette. Each site uses its own settings record.

The public booking journey test is a **browser integration test with mocked Wix HTTP responses**, not a live merchant or charge test. It covers paid/unpaid confirmation, safe payment links, stale availability, payment API failures, and double submission. Complete the Wix staging-site checklist before shipping a production release.

Management UI regression tests cover accent-insensitive searching, status filters, date-based operational queues and source-level wiring of the new dashboard and equipment/reservation interfaces. They do not replace a manual check inside the Wix dashboard.

For payment reconciliation before App Market validation, run `npm run test:billing`. It checks exact settlement amounts, currency and link identity, refunds/deposits, and plan names. Wix API calls are mocked: these tests cannot replace live Wix checkout and staging validation.

## Phase 5 — cohérence des paiements sur Wix staging

Lancer `npm run test:staging-finance` pour contrôler le calcul du solde, les remboursements, l'état du parcours paiement et l'absence de confirmation client non vérifiée. Cette suite ne remplace pas un paiement Wix sandbox réel.
