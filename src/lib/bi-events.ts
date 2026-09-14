export type RentalFlowBiEventName =
  | 'APP_DASHBOARD_LOADED'
  | 'APP_FINISHED_CONFIGURATION'
  | 'APP_SETUP_FINISHED'
  | 'PRIMARY_ACTION_PERFORMED'
  | 'CUSTOM';

export type RentalFlowCustomBiEventName =
  | 'rentalflow_first_asset_created'
  | 'rentalflow_reservation_created'
  | 'rentalflow_online_booking_created';

export type RentalFlowBiEventInput = {
  eventName: RentalFlowBiEventName;
  customEventName?: RentalFlowCustomBiEventName;
  eventData?: Record<string, string>;
};

const STANDARD_EVENTS = new Set<RentalFlowBiEventName>([
  'APP_DASHBOARD_LOADED',
  'APP_FINISHED_CONFIGURATION',
  'APP_SETUP_FINISHED',
  'PRIMARY_ACTION_PERFORMED',
  'CUSTOM',
]);

const CUSTOM_EVENTS = new Set<RentalFlowCustomBiEventName>([
  'rentalflow_first_asset_created',
  'rentalflow_reservation_created',
  'rentalflow_online_booking_created',
]);

export function normalizeBiEventInput(value: unknown): RentalFlowBiEventInput | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const eventName = source.eventName;
  if (typeof eventName !== 'string' || !STANDARD_EVENTS.has(eventName as RentalFlowBiEventName)) return null;

  const customEventName = typeof source.customEventName === 'string'
    ? source.customEventName as RentalFlowCustomBiEventName
    : undefined;

  if (eventName === 'CUSTOM' && (!customEventName || !CUSTOM_EVENTS.has(customEventName))) return null;
  if (eventName !== 'CUSTOM' && customEventName) return null;

  const eventData: Record<string, string> = {};
  if (source.eventData && typeof source.eventData === 'object') {
    for (const [key, raw] of Object.entries(source.eventData as Record<string, unknown>)) {
      if (!key || key.length > 80) continue;
      if (typeof raw === 'string') eventData[key] = raw.slice(0, 500);
      else if (typeof raw === 'number' || typeof raw === 'boolean') eventData[key] = String(raw);
    }
  }

  return {
    eventName: eventName as RentalFlowBiEventName,
    ...(customEventName ? { customEventName } : {}),
    ...(Object.keys(eventData).length ? { eventData } : {}),
  };
}

export async function sendBiEventToWix(
  authorization: string,
  input: RentalFlowBiEventInput
): Promise<void> {
  if (!authorization) throw new Error('MISSING_AUTHORIZATION');

  const response = await fetch('https://www.wixapis.com/apps/v1/bi-event', {
    method: 'POST',
    headers: {
      authorization,
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`WIX_BI_EVENT_${response.status}${details ? `: ${details.slice(0, 300)}` : ''}`);
  }
}
