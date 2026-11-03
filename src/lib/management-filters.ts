import type { Asset, AssetStatus, Reservation } from '../domain/types';

export type EquipmentStatusFilter = 'ALL' | AssetStatus;
export type ReservationListFilter = 'ALL' | 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type OperationsFilter = 'DEPARTURES' | 'RETURNS' | 'LATE' | 'PREPARE';

export function normalizeManagementSearch(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-CA')
    .trim()
    .replace(/\s+/g, ' ');
}

function matchesFields(query: string, fields: unknown[]): boolean {
  if (!query) return true;
  const haystack = normalizeManagementSearch(fields.filter(Boolean).join(' '));
  return query.split(' ').every((term) => haystack.includes(term));
}

export function filterManagementAssets(
  assets: Asset[],
  search: string,
  status: EquipmentStatusFilter = 'ALL',
): Asset[] {
  const query = normalizeManagementSearch(search);
  return assets.filter((asset) =>
    (status === 'ALL' || asset.status === status)
    && matchesFields(query, [
      asset.title, asset.assetNumber, asset.productType,
      asset.categoryName, asset.serialNumber, asset.status,
    ]),
  );
}

function validDate(value?: Date | string): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function filterManagementReservations(
  reservations: Reservation[],
  search: string,
  filter: ReservationListFilter = 'ALL',
  now: Date = new Date(),
): Reservation[] {
  const query = normalizeManagementSearch(search);
  return reservations.filter((reservation) => {
    const status = reservation.status;
    if (status === 'ERROR') return false;
    if (filter === 'UPCOMING') {
      const start = validDate(reservation.startDateTime);
      if (status !== 'CONFIRMED' || !start || start < now) return false;
    }
    if (filter === 'IN_PROGRESS' && !['CONFIRMED', 'RENTED', 'RETURNED'].includes(status || '')) return false;
    if (filter === 'COMPLETED' && status !== 'COMPLETED') return false;
    if (filter === 'CANCELLED' && status !== 'CANCELLED') return false;
    return matchesFields(query, [
      reservation.reservationNumber, reservation.customerName,
      reservation.customerEmail, reservation.customerPhone,
      reservation.customerNumber, reservation.workflowStage, status,
    ]);
  });
}

export function getOperationsForDashboard(reservations: Reservation[], now: Date = new Date()) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const active = reservations.filter((reservation) =>
    !['CANCELLED', 'ERROR', 'COMPLETED'].includes(reservation.status || ''),
  );
  const sameDay = (value?: Date | string) => {
    const date = validDate(value);
    return !!date && date.getFullYear() === now.getFullYear()
      && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  };
  const departures = active.filter((r) => r.status === 'CONFIRMED' && sameDay(r.startDateTime));
  const returns = active.filter((r) => r.status === 'RENTED' && sameDay(r.endDateTime));
  const late = active.filter((r) => {
    const end = validDate(r.endDateTime);
    return r.status === 'RENTED' && !!end && end < now;
  });
  const prepare = active.filter((r) => {
    const start = validDate(r.startDateTime);
    return r.status === 'CONFIRMED' && !!start && start >= now && start <= tomorrow;
  });
  const upcoming = active.filter((r) => {
    const start = validDate(r.startDateTime);
    return r.status === 'CONFIRMED' && !!start && start >= startOfDay;
  }).sort((a, b) => validDate(a.startDateTime)!.getTime() - validDate(b.startDateTime)!.getTime());
  return { departures, returns, late, prepare, upcoming };
}
