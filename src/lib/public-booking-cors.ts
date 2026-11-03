/**
 * Wix's httpClient.fetchWithAuth uses an Authorization bearer token for site widgets.
 * The widget can be hosted on arbitrary merchant domains, so an origin allowlist
 * is not feasible here. Allow cross-origin *non-credentialed* requests only.
 * Do not reflect Origin, arbitrary requested headers, or allow cookie credentials.
 */
export function publicBookingCorsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'Authorization,Content-Type,X-Wix-Linguist',
    'access-control-max-age': '600',
  };
}
