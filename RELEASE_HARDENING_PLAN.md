# RentalFlow v1 release hardening

This branch groups the App Market hardening work into one update.

## Implementation status

1. **Wix plans and inventory limits — implemented**
   - Wix App Management plan detection (`getAppInstance`).
   - Basic: 5 active assets.
   - Starter: 25 active assets.
   - Business: 100 active assets.
   - Pro: unlimited active assets.

2. **Plan enforcement — implemented for inventory and public booking**
   - Weekly pricing: Starter+.
   - Monthly pricing and long-term discounts: Business+.
   - Documents and Wix payments: Starter+ in the public booking flow.
   - Public security deposits: Starter+.
   - Production plan lookup fails closed to Basic.
   - Remaining legacy dashboard actions should continue to be migrated from UI-only controls to backend-enforced commands in future releases.

3. **Wix payment synchronization — implemented for v1**
   - Payment Links are created for eligible plans.
   - Pending Wix payments are automatically reconciled when RentalFlow Dashboard loads.
   - Confirmed payments update the local payment record and reservation balance.
   - A real-time `Payment Link Payment Created` event extension remains a post-v1 optimization.

4. **French / English localization — included**
   - Dashboard pages are localized in French and English.
   - Settings includes Automatic / Français / English.
   - Public widget follows the Wix site language.
   - Wix-hosted extension labels still need App Dashboard translations.

5. **Scale and double-booking hardening — implemented for the public flow**
   - Added collection indexes for common lookups.
   - Availability queries are restricted to the requested time window.
   - Added per-asset booking locks with a unique index and expiration to prevent concurrent public bookings from both succeeding.

6. **Release checklist / validation — implemented**
   - Updated `BETA_RELEASE_CHECKLIST.md`.
   - Added GitHub Actions validation for `npm run typecheck` and `npm run build`.

## Release gate

Do not publish or merge as a production-ready release until:

```bash
npm run typecheck
npm run build
```

both pass, the four Wix pricing packages are mapped correctly, and the functional tests in `BETA_RELEASE_CHECKLIST.md` are completed on a Wix test site.

Because this update changes Data Collections and indexes, publish it as a **Major** Wix app version.
