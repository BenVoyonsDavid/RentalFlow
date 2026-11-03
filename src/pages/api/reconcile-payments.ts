import type { APIRoute } from 'astro';
import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import { requireDashboardUser } from '../../server/request-auth';
import { COLLECTIONS } from '../../lib/collection-ids';
import { collectAllPages } from '../../lib/pagination';
import type { Payment, Reservation } from '../../domain/types';
import { reservationBalanceCents, reservationBalanceNeedsSync, reservationStageAfterBalance, verifiedWixPaymentLink } from '../../lib/payment-reconciliation';

const PAYMENTS = COLLECTIONS.payments;
const RESERVATIONS = COLLECTIONS.reservations;
const ACTIVITY = COLLECTIONS.activityLog;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function elevatedFind(query: any): Promise<any> {
  const run = auth.elevate(query.find.bind(query));
  return run({ consistentRead: true });
}

async function elevatedUpdate(collectionId: string, item: Record<string, unknown>): Promise<any> {
  const update = auth.elevate(items.update);
  const itemId = item._id;
  if (typeof itemId !== 'string' || !itemId) throw new Error('MISSING_ITEM_ID');
  return update(collectionId, { ...item, _id: itemId });
}

async function elevatedInsert(collectionId: string, item: Record<string, unknown>): Promise<any> {
  const insert = auth.elevate(items.insert);
  return insert(collectionId, item);
}

async function syncReservationBalance(reservationId: string): Promise<{ balanceDueCents: number; updated: boolean }> {
  const [reservationResult, payments] = await Promise.all([
    elevatedFind(items.query(RESERVATIONS).eq('_id', reservationId).limit(1)),
    collectAllPages(async (offset, limit) => {
      const result = await elevatedFind(
        items.query(PAYMENTS)
          .eq('reservationId', reservationId)
          .skip(offset)
          .limit(limit),
      );
      return (result.items || []) as Payment[];
    }, 100),
  ]);

  const reservation = reservationResult.items?.[0] as Reservation | undefined;
  if (!reservation?._id) throw new Error('RECONCILIATION_RESERVATION_NOT_FOUND');

  const balanceDueCents = reservationBalanceCents(
    reservation.totalCents || 0,
    payments,
    reservation.currency || 'CAD',
  );

  const needsSync = reservationBalanceNeedsSync(reservation, balanceDueCents);
  if (needsSync) {
    await elevatedUpdate(RESERVATIONS, {
      ...reservation,
      balanceDueCents,
      workflowStage: reservationStageAfterBalance(reservation.workflowStage, balanceDueCents),
    });
  }

  return { balanceDueCents, updated: needsSync };
}

async function reconcilePendingPayments(): Promise<{ checked: number; updated: number; repaired: number; repairPending: number }> {
  const pending = await collectAllPages(async (offset, limit) => {
    const result = await elevatedFind(
      items.query(PAYMENTS)
        .eq('status', 'PENDING')
        .eq('wixOnlinePayment', true)
        .skip(offset)
        .limit(limit),
    );
    return (result.items || []) as Payment[];
  }, 100);
  let getPaymentLink: ((id: string) => Promise<any>) | null = null;
  if (pending.length) {
    const wixGetPaid = await import('@wix/get-paid') as any;
    const paymentLinksApi = wixGetPaid.paymentLinks;
    if (!paymentLinksApi?.getPaymentLink) throw new Error('GET_PAYMENT_LINK_UNAVAILABLE');
    getPaymentLink = auth.elevate(paymentLinksApi.getPaymentLink);
  }

  let updated = 0;

  for (const payment of pending) {
    if (!payment._id || !payment.wixPaymentLinkId) continue;

    try {
      const response = await getPaymentLink!(payment.wixPaymentLinkId);
      const evidence = verifiedWixPaymentLink(response, payment);
      if (!evidence) continue;

      const confirmed: Payment = {
        ...payment,
        status: 'PAID',
        amountCents: evidence.amountCents,
        paymentDate: evidence.paymentDate || payment.paymentDate || new Date(),
        wixTransactionId: evidence.transactionId || payment.wixTransactionId || '',
        notes: [payment.notes, 'Paiement confirmé automatiquement depuis Wix Payment Links.'].filter(Boolean).join(' '),
      };
      // Save the receipt before calculating balance so the calculation includes it.
      await elevatedUpdate(PAYMENTS, confirmed);

      try {
        if (!payment.reservationId) throw new Error('RECONCILIATION_RESERVATION_MISSING');
        const { balanceDueCents } = await syncReservationBalance(payment.reservationId);
        await elevatedUpdate(PAYMENTS, { ...confirmed, remainingBalanceCents: balanceDueCents });
      } catch (balanceError) {
        // The receipt remains PAID. A later run scans PAID Wix receipts and repairs
        // their linked reservation without needing new collection fields.
        console.error('RentalFlow reservation balance synchronization is pending repair.', balanceError);
      }

      // Audit logging must not roll back or hide an already verified receipt.
      try {
        await elevatedInsert(ACTIVITY, {
          reservationId: payment.reservationId || '',
          reservationNumber: payment.reservationNumber || '',
          actionType: 'ONLINE_PAYMENT_CONFIRMED',
          description: `Paiement Wix ${payment.paymentNumber || ''} confirmé pour ${(evidence.amountCents / 100).toFixed(2)} ${payment.currency || ''}.`,
          actor: 'RentalFlow Payment Sync',
          eventDate: new Date(),
        });
      } catch (activityError) {
        console.error('RentalFlow payment confirmation audit logging failed.', activityError);
      }

      updated += 1;
    } catch (error) {
      console.error(`RentalFlow could not reconcile payment ${payment.paymentNumber || payment._id || ''}.`, error);
    }
  }

  // Wix collections already installed do not have a balanceSyncPending field.
  // Re-check paid online receipts on every sync, including legacy PAID records
  // whose reservation write may have failed on a previous dashboard load.
  // This is idempotent: unchanged balances and snapshots are never rewritten.
  const paidOnline = await collectAllPages(async (offset, limit) => {
    const result = await elevatedFind(
      items.query(PAYMENTS)
        .eq('status', 'PAID')
        .eq('wixOnlinePayment', true)
        .skip(offset)
        .limit(limit),
    );
    return (result.items || []) as Payment[];
  }, 100);

  const byReservation = new Map<string, Payment[]>();
  let repairPending = 0;
  for (const payment of paidOnline) {
    if (!payment._id || !payment.reservationId) {
      repairPending += 1;
      continue;
    }
    const group = byReservation.get(payment.reservationId) || [];
    group.push(payment);
    byReservation.set(payment.reservationId, group);
  }

  let repaired = 0;
  for (const [reservationId, linkedReceipts] of byReservation) {
    try {
      const { balanceDueCents, updated } = await syncReservationBalance(reservationId);
      let changed = updated;
      for (const payment of linkedReceipts) {
        if (payment.remainingBalanceCents === balanceDueCents) continue;
        await elevatedUpdate(PAYMENTS, { ...payment, remainingBalanceCents: balanceDueCents });
        changed = true;
      }
      if (changed) repaired += 1;
    } catch (error) {
      repairPending += 1;
      console.error('RentalFlow could not repair a verified payment balance.', error);
    }
  }

  return { checked: pending.length, updated, repaired, repairPending };
}

export const POST: APIRoute = async () => {
  try {
    await requireDashboardUser();
    return json(await reconcilePendingPayments());
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return json({ error: 'Unauthorized' }, 401);
    if (error instanceof Error && error.message === 'FORBIDDEN') return json({ error: 'Forbidden' }, 403);
    console.error('RentalFlow payment reconciliation failed', error);
    return json({ error: 'Impossible de synchroniser les paiements Wix.' }, 500);
  }
};

