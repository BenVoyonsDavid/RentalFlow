import { httpClient } from '@wix/essentials';

export function publicBookingApiUrl(params = ''): string {
  const url = new URL('/api/public-booking', import.meta.url);
  if (params) url.search = params;
  return url.toString();
}

export async function fetchPublicBookingJson(
  url: string,
  options?: RequestInit,
): Promise<any> {
  let response: Response;

  try {
    response = await httpClient.fetchWithAuth(url, options);
  } catch {
    throw new Error(
      'Impossible de joindre le service de réservation. Réessayez dans quelques instants.',
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Erreur ${response.status}`);
  }

  return payload;
}
