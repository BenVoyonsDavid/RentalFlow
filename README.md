# RentalFlow

RentalFlow is a Wix app for managing physical rental inventory from reservation to return.

## Current development milestone

- Wix CLI / Astro project
- Dashboard page registered in Wix
- `assets` app data collection
- Asset inventory dashboard
- Create-asset form
- Duplicate asset-number validation
- Live inventory counters

## Development

```powershell
npm install
npm run dev
```

## Build

```powershell
npm run build
```

## Wix identifiers

- Project ID: `rental-flow`
- Namespace: `@pilotedavid1/rental-flow`
- Code identifier: `rentalflow`

## Security

Local Wix environment files such as `.env.local`, `.wix/`, generated `.astro/` files and `node_modules/` are intentionally excluded from Git.

## Français / English

RentalFlow includes French and English interfaces for all six dashboard pages, the booking widget and its editor panel. Use the **Langue / Language** selector at the top of each screen. Dates, currency formatting, status labels, validation messages and generated document headings follow the selection.

- Dashboard: the saved preference takes priority, followed by a supported browser language (French fallback).
- Booking widget: an explicit `lang="fr"` or `lang="en"` attribute takes priority initially, followed by the visitor's saved booking preference, the host page language and browser language. Visitors can change it with the selector.
- Dashboard and booking preferences are separate. Storage restrictions do not prevent switching languages during the session.
- Switching language keeps unsaved forms, selected equipment, rental dates and payment mode.
- Company/equipment names, customer data, tax names, custom templates and historical document content are preserved as entered. Use separate French and English templates for custom contract terms.
- Wix sidebar registration titles are static bilingual labels (`Réservations / Reservations`, etc.); the screen contents switch immediately. Wix's hosted checkout uses Wix's own language settings.

Translations live in `src/lib/i18n/en.json`, with French source messages as keys. Use `t(source, parameters)` in dashboard rendering and `feedback(source, parameters)` for stateful messages. On the server, use `translate(source, requestLanguage, parameters)` so simultaneous requests cannot share language state. Keep database enums and identifiers unchanged.

### Localization checks

```sh
npm install
npx playwright install chromium --only-shell
npm run test:i18n
```

These tests use local Wix service doubles and do not contact a live Wix site. They check concurrent API languages, interpolation, all registered dashboard screens, remembered preferences, unsaved forms, widget booking/validation and restricted browser storage. Complete a Wix preview before releasing to verify the native dashboard shell and hosted checkout.
