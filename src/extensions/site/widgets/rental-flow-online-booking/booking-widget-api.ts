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
  } catch (error) {
    const detail = error instanceof Error
      ? error.message
      : String(error || 'Failed to fetch');
    const moduleOrigin = (() => {
      try {
        return new URL(import.meta.url).origin;
      } catch {
        return '';
      }
    })();
    const pageOrigin = typeof window !== 'undefined'
      ? window.location.origin
      : '';

    let plainPing = 'not-run';
    let authPing = 'not-run';
    const pingUrl = moduleOrigin
      ? `${moduleOrigin}/api/rentalflow-network-ping`
      : '';

    if (pingUrl) {
      try {
        const pingResponse = await fetch(pingUrl, {
          method: 'GET',
          mode: 'cors',
          cache: 'no-store',
        });
        const body = (await pingResponse.text().catch(() => ''))
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 240);
        plainPing = `HTTP ${pingResponse.status}${body ? ` [${body}]` : ''}`;
      } catch (pingError) {
        plainPing = pingError instanceof Error
          ? pingError.message
          : 'failed';
      }

      try {
        const pingResponse = await httpClient.fetchWithAuth(
          pingUrl,
          { method: 'GET' },
        );
        const body = (await pingResponse.text().catch(() => ''))
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 240);
        authPing = `HTTP ${pingResponse.status}${body ? ` [${body}]` : ''}`;
      } catch (pingError) {
        authPing = pingError instanceof Error
          ? pingError.message
          : 'failed';
      }
    }

    throw new Error(
      `${detail} · backend=${moduleOrigin || 'absent'} · page=${pageOrigin || 'absent'} · tried=${url} · ping=${plainPing} · authPing=${authPing}`,
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Erreur ${response.status}`);
  }

  return payload;
}
