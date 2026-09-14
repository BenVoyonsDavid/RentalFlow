import type { APIRoute } from 'astro';
import { items } from '@wix/data';
import { auth } from '@wix/essentials';

const SETTINGS = '@pilotedavid1/rental-flow/app-settings';
const ASSETS = '@pilotedavid1/rental-flow/assets';
const DOCUMENT_TEMPLATES = '@pilotedavid1/rental-flow/document-templates';

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }
  return { message: String(error ?? 'Unknown error') };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function elevatedQuery(collectionId: string): any {
  const query = auth.elevate(items.query);
  return query(collectionId);
}

export const GET: APIRoute = async ({ request }) => {
  const hasAuthorizationHeader = Boolean(request.headers.get('authorization'));
  const baseUrl = new URL(request.url).origin;

  if (!hasAuthorizationHeader) {
    return json({
      reachedEndpoint: true,
      hasAuthorizationHeader: false,
      baseUrl,
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Cet endpoint doit être appelé avec httpClient.fetchWithAuth().',
    }, 401);
  }

  const result: Record<string, unknown> = {
    reachedEndpoint: true,
    hasAuthorizationHeader: true,
    baseUrl,
  };

  try {
    const tokenInfo = await auth.getTokenInfo();
    result.token = {
      ok: true,
      hasInstanceId: Boolean(tokenInfo?.instanceId),
      hasSiteId: Boolean(tokenInfo?.siteId),
      subjectType: tokenInfo?.subjectType || null,
    };
  } catch (error) {
    result.token = {
      ok: false,
      error: errorDetails(error),
    };
  }

  try {
    const settings = await elevatedQuery(SETTINGS).eq('settingsKey', 'default').limit(1).find();
    result.settingsRead = {
      ok: true,
      count: settings.items?.length || 0,
    };
  } catch (error) {
    result.settingsRead = {
      ok: false,
      error: errorDetails(error),
    };
  }

  try {
    const assets = await elevatedQuery(ASSETS).limit(5).find();
    result.assetsRead = {
      ok: true,
      count: assets.items?.length || 0,
    };
  } catch (error) {
    result.assetsRead = {
      ok: false,
      error: errorDetails(error),
    };
  }

  try {
    const templates = await elevatedQuery(DOCUMENT_TEMPLATES).limit(5).find();
    const templateCount = templates.items?.length || 0;
    result.templatesRead = {
      ok: true,
      count: templateCount,
      optional: true,
      configured: templateCount > 0,
    };
  } catch (error) {
    result.templatesRead = {
      ok: false,
      optional: true,
      error: errorDetails(error),
    };
  }

  return json(result);
};
