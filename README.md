# RentalFlow

**Rentals that move with you.**

RentalFlow is a Wix rental-management app for businesses that rent equipment, vehicles, RVs, vacation assets, and other physical inventory.

## v1 capabilities

- Reservation management and availability calendar
- Customer records and rental history
- Daily, weekly, monthly, and long-term rental pricing
- Quotes, contracts, invoices, payments, deposits, inspections, and damage tracking
- Public online booking widget with Wix Payment Links
- French / English localization
- Wix pricing plans with inventory limits:
  - Basic: 5 active assets
  - Starter: 25 active assets
  - Business: 100 active assets
  - Pro: unlimited active assets
- Concurrent public-booking protection and indexed data collections
- Automatic reconciliation of pending Wix Payment Links when the RentalFlow dashboard loads

## Validation

Before releasing a production version:

```bash
npm run typecheck
npm run build
```

See `BETA_RELEASE_CHECKLIST.md` for the full App Market release checklist.
