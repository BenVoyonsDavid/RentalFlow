import type { extensions } from '@wix/astro/builders';

/**
 * Wix's current Dashboard Page documentation supports metaData (searchable,
 * title and description), while the @wix/astro 2.75.0 generated Options type
 * still omits that property. Preserve the supported builder runtime payload
 * without suppressing types across unrelated extension fields.
 *
 * Remove this compatibility type after updating to a Wix SDK whose Options
 * includes metaData; confirm release-level dashboard search registration.
 */
export type DashboardSearchPageOptions = Parameters<typeof extensions.dashboardPage>[0] & {
  metaData: {
    searchable: true;
    title: string;
    description: string;
  };
};
