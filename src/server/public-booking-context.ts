import { appInstances } from '@wix/app-management';
import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import type { AppSettings, Asset, DocumentTemplate } from '../domain/types';
import type { BookingCatalogItem } from '../lib/booking-catalog';
import { COLLECTIONS } from '../lib/collection-ids';
import { defaultPublicBookingSettings } from '../lib/public-booking-config';
import { collectAllPages } from '../lib/pagination';
import {
  planFromAppInstanceResponse,
  type RentalFlowPlan,
} from '../lib/plans';

const ASSETS = COLLECTIONS.assets;
const CATALOG = COLLECTIONS.catalogItems;
const DOCUMENT_TEMPLATES = COLLECTIONS.documentTemplates;
const SETTINGS = COLLECTIONS.appSettings;

function elevatedQuery(collectionId: string): any {
  const query = auth.elevate(items.query);
  return query(collectionId);
}

async function elevatedFind(query: any): Promise<any> {
  return query.find();
}

function isWixDevelopmentRequest(request: Request): boolean {
  const origin = String(request.headers.get('origin') || '').toLowerCase();
  const referer = String(request.headers.get('referer') || '').toLowerCase();

  return origin.includes('wix-development-sites.org')
    || referer.includes('wix-development-sites.org');
}

export async function loadCurrentPlan(
  request: Request,
): Promise<RentalFlowPlan> {
  try {
    const getInstance = auth.elevate(appInstances.getAppInstance);
    const response = await getInstance();
    const resolved = planFromAppInstanceResponse(response);

    if (resolved === 'NO_PLAN' && isWixDevelopmentRequest(request)) {
      return 'TRIAL';
    }

    return resolved;
  } catch (error) {
    console.error('RentalFlow public booking could not resolve Wix plan.', error);
    return isWixDevelopmentRequest(request) ? 'TRIAL' : 'NO_PLAN';
  }
}

export async function loadSettingsAndTemplates(): Promise<{
  settings: AppSettings;
  templates: DocumentTemplate[];
}> {
  const [settingsResult, templatesResult] = await Promise.all([
    elevatedFind(
      elevatedQuery(SETTINGS)
        .eq('settingsKey', 'default')
        .limit(1),
    ),
    elevatedFind(elevatedQuery(DOCUMENT_TEMPLATES).limit(100)),
  ]);

  const saved = settingsResult.items?.[0] as AppSettings | undefined;

  return {
    settings: {
      ...defaultPublicBookingSettings,
      ...(saved || {}),
    },
    templates: (templatesResult.items || []) as DocumentTemplate[],
  };
}

export async function loadActiveAssets(): Promise<Asset[]> {
  return collectAllPages(async (offset, limit) => {
    const result = await elevatedFind(
      elevatedQuery(ASSETS)
        .ne('active', false)
        .ne('status', 'INACTIVE')
        .skip(offset)
        .limit(limit),
    );

    return (result.items || []) as Asset[];
  }, 1000);
}

export async function loadActiveCatalog(): Promise<BookingCatalogItem[]> {
  const catalog = await collectAllPages(async (offset, limit) => {
    const result = await elevatedFind(
      elevatedQuery(CATALOG)
        .ne('active', false)
        .skip(offset)
        .limit(limit),
    );

    return (result.items || []) as BookingCatalogItem[];
  }, 1000);

  return catalog.filter((item) => item.active !== false);
}
