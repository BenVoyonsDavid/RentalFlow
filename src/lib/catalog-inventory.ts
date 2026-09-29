import type { ReservationItem } from '../domain/types';

export function activeCatalogReservedQuantity(
  reservationItems: ReservationItem[],
  catalogItemId: string,
  excludeReservationId = '',
): number {
  return reservationItems.reduce((total, item) => {
    if (!catalogItemId || item.catalogItemId !== catalogItemId) return total;
    if (excludeReservationId && item.reservationId === excludeReservationId) return total;
    if (item.status === 'CANCELLED' || item.status === 'COMPLETED') return total;

    const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
    return total + quantity;
  }, 0);
}

export function availableCatalogStock(stockQuantity: unknown, reservedQuantity: unknown): number {
  const stock = Math.max(0, Math.floor(Number(stockQuantity) || 0));
  const reserved = Math.max(0, Math.floor(Number(reservedQuantity) || 0));
  return Math.max(0, stock - reserved);
}
