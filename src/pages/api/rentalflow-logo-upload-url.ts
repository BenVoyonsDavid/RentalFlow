import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';
import { files } from '@wix/media';
import { requireDashboardUser } from '../../server/request-auth';

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireDashboardUser();

    const body = await request.json().catch(() => null) as {
      mimeType?: unknown;
      fileName?: unknown;
      sizeInBytes?: unknown;
    } | null;

    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : '';
    const originalFileName = typeof body?.fileName === 'string' ? body.fileName.trim() : '';
    const sizeInBytes = Number(body?.sizeInBytes);

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return json({ error: 'Type d’image non pris en charge.' }, 400);
    }
    if (!originalFileName) {
      return json({ error: 'Nom de fichier manquant.' }, 400);
    }
    if (!Number.isFinite(sizeInBytes) || sizeInBytes <= 0 || sizeInBytes > 10 * 1024 * 1024) {
      return json({ error: 'Le logo doit faire entre 1 octet et 10 Mo.' }, 400);
    }

    const fileName = originalFileName.split(/[\\/]/).pop()?.slice(0, 255) || 'logo';
    const elevatedGenerateFileUploadUrl = auth.elevate(files.generateFileUploadUrl);
    const generated = await elevatedGenerateFileUploadUrl(mimeType, {
      fileName,
      filePath: '/RentalFlow/logos',
      private: false,
    });

    if (!generated.uploadUrl) {
      return json({ error: 'Wix n’a pas retourné d’URL de téléversement.' }, 502);
    }

    return json({ uploadUrl: generated.uploadUrl });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return json({ error: 'Accès refusé. Cette action doit être effectuée depuis le tableau de bord Wix.' }, 403);
    }
    const message = error instanceof Error ? error.message : 'Impossible de préparer le téléversement du logo.';
    return json({ error: message }, 500);
  }
};
