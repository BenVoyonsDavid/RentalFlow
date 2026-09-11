# RentalFlow v1 release hardening

This branch groups the App Market hardening work into one update:

1. Real Wix plan detection and inventory limits (Basic 5 / Starter 25 / Business 100 / Pro unlimited).
2. Plan enforcement in dashboard and public booking flows.
3. Wix payment status synchronization groundwork.
4. Bilingual FR/EN branch included and validated before merge.
5. Query/index/concurrency hardening for scale and double-booking protection.
6. Updated App Market release checklist.

The update must pass `npm run typecheck` and `npm run build` before release.
