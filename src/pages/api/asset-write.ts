import type { APIRoute } from 'astro';
import type { Asset } from '../../domain/types';
import { AssetWriteError, saveAssetWithPlan } from '../../server/asset-service';
import { requireDashboardUser } from '../../server/request-auth';

type AssetWriteRequest = { assetId?: string; asset?: Asset };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireDashboardUser();
    const body = await request.json() as AssetWriteRequest;
    if (!body?.asset || typeof body.asset !== 'object') {
      return json({ error: 'Données d’équipement invalides.' }, 400);
    }
    const asset = await saveAssetWithPlan(request, String(body.assetId || '').trim() || undefined, body.asset);
    return json({ asset }, 200);
  } catch (error) {
    if (error instanceof AssetWriteError) return json({ error: error.message }, error.status);
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return json({ error: 'Unauthorized' }, 401);
    if (error instanceof Error && error.message === 'FORBIDDEN') return json({ error: 'Forbidden' }, 403);
    console.error('RentalFlow asset write failed', error);
    return json({ error: 'Impossible d’enregistrer cet équipement.' }, 500);
  }
};
