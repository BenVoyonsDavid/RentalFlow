import { httpClient } from '@wix/essentials';
import type { RentalFlowBiEventInput } from './bi-events';

export async function sendRentalFlowBiEvent(input: RentalFlowBiEventInput): Promise<boolean> {
  try {
    const response = await httpClient.fetchWithAuth(`${import.meta.env.BASE_API_URL}/api/bi-event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      console.warn('RentalFlow BI event was rejected.', response.status, details);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('RentalFlow BI event could not be sent.', error);
    return false;
  }
}
