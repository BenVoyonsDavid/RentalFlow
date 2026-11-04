# RentalFlow — Wix dashboard search metadata: resolved on app draft, pending release

Updated on November 3, 2026 (America/Toronto).

## Evidence and root cause

After the Wix CLI successfully created **app version 12.11.0**, the Wix App Market checklist still listed all nine dashboard pages as not searchable. We checked both sides:

1. GitHub `main` includes `metaData: { searchable: true, title, description }` for all nine pages, and the descriptions are valid.
2. The [Wix CLI dashboard-page guide](https://dev.wix.com/docs/build-apps/develop-your-app/develop-an-app-with-the-cli/supported-extensions/dashboard/dashboard-pages/dashboard-page-extension-files-and-code) documents precisely this structure.
3. [CI diagnostic](https://github.com/BenVoyonsDavid/RentalFlow/actions/runs/41755698260) loaded the **real `@wix/astro` 2.75.0 builder** and confirmed that each extension's `options.metaData` is present. The loss therefore happens *downstream from the builder*, when the CLI registers the components with the Wix App Extensions service.
4. The documented [Get Draft App Components API](https://dev.wix.com/docs/api-reference/app-management/app-extensions/app-extensions/get-draft-app-components) showed all nine `BACK_OFFICE_PAGE` components without `data.backOfficePage.metaData`.

## Draft repair completed on Wix

Using the documented [Upsert Components API](https://dev.wix.com/docs/api-reference/app-management/app-extensions/app-extensions/upsert-components), all **nine existing components** were updated **in the app draft**, preserving their existing IDs, routes, iframe URLs, permissions and sidebar options. Each received:

```json
{
  "metaData": {
    "searchable": true,
    "title": "<matching page title>",
    "description": "<the existing page-specific description>"
  }
}
```

The API returned **9/9 component results**. A fresh read via Get Draft App Components confirmed **9/9 have `metaData.searchable: true` and a description**.

No site data was edited. This is **not a published app version**: Wix says component changes remain draft until incorporated in an app release. **Version 12.11.0 remains the most recently verified production version.**

## Required next step: release dashboard component changes

Go to the [RentalFlow Developer Center](https://dev.wix.com/apps/8ee574c2-70b9-45e9-98ed-9e8439a26e5d/home?referralInfo=wix-cli), find the application version / distribution section, review the nine pending dashboard component updates, then create a **minor app release** from those registered draft components. Wix's App Versions UI may offer a release flow separate from the CLI.

**IMPORTANT**: Do not blindly run `wix release` to publish these patched components! The current Wix CLI 1.1.252 / `@wix/astro` 2.75.0 release path had stripped `metaData` previously. A normal CLI release might re-register the components from TypeScript **without** the metadata again. Verify in a controlled preview, or fix/update the CLI serialization path first. Do not claim the checklist is clear until Wix confirms it.

## Regression check

`node tests/inspect-dashboard-extension-runtime.mjs`

This command checks the extension builder runtime output for all nine pages. **It does not prove registered app component metadata.** After *every* future Wix release, use the App Extensions read API to verify that all nine components have the expected `backOfficePage.metaData`. If the fields disappear again, the CLI registration issue remains.

## Remaining recommendations

- **Add BI events**: The code calls `APP_DASHBOARD_LOADED` after the dashboard has loaded and sends primary actions; the developer-API test using account/site credentials was denied with HTTP **403** and cannot prove receipt by an app-authenticated dashboard. Do not send `APP_FINISHED_CONFIGURATION` merely to clear a warning because it changes Wix onboarding semantics.
- **Add a video**: The published App Market `galleryVideos.assets` array currently has **zero videos**. Record a real promotional video using the scenario in [APP_MARKET_VIDEO_PRODUCTION.md](./APP_MARKET_VIDEO_PRODUCTION.md), upload it to YouTube, and add its URL under **App Profile > Media**.

These items are recommendations, not release blockers.
