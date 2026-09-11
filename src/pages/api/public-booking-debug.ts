import type { APIRoute } from 'astro';
import { items } from '@wix/data';
import { auth } from '@wix/essentials';

const SETTINGS = '@pilotedavid1/rental-flow/app-settings';
const ASSETS = '@pilotedavid1/rental-flow/assets';

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

async function elevatedFind(query: any): Promise<any> {
  const run = auth.elevate(query.find.bind(query));
  return run();
}

export const GET: APIRoute = async ({ request }) => {
  const result: Record<string, unknown> = {
    reachedEndpoint: true,
    hasAuthorizationHeader: Boolean(request.headers.get('authorization')),
    baseUrl: new URL(request.url).origin,
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
    const settings = await elevatedFind(items.query(SETTINGS).limit(1));
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
    const assets = await elevatedFind(items.query(ASSETS).limit(5));
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

  return json(result);
};
