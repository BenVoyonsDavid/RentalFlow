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

async function syncReservationBalance(reservationId: string): Promise<number> {
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

  if (reservationBalanceNeedsSync(reservation, balanceDueCents)) {
    await elevatedUpdate(RESERVATIONS, {
      ...reservation,
      balanceDueCents,
      workflowStage: reservationStageAfterBalance(reservation.workflowStage, balanceDueCents),
    });
  }

  return balanceDueCents;
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
        balanceSyncPending: true,
        amountCents: evidence.amountCents,
        paymentDate: evidence.paymentDate || payment.paymentDate || new Date(),
        wixTransactionId: evidence.transactionId || payment.wixTransactionId || '',
        notes: [payment.notes, 'Paiement confirmé automatiquement depuis Wix Payment Links.'].filter(Boolean).join(' '),
      };
      // Save the receipt before calculating balance so the calculation includes it.
      await elevatedUpdate(PAYMENTS, confirmed);

      try {
        if (!payment.reservationId) throw new Error('RECONCILIATION_RESERVATION_MISSING');
        const balanceDueCents = await syncReservationBalance(payment.reservationId);
        // Clearing the repair flag is the last step, only after the reservation was saved.
        await elevatedUpdate(PAYMENTS, {
          ...confirmed,
          remainingBalanceCents: balanceDueCents,
          balanceSyncPending: false,
        });
      } catch (balanceError) {
        // Keep balanceSyncPending=true for an automatic retry on the next dashboard load.
        // Never change the verified receipt back from PAID.
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

  // A receipt may have been saved as PAID even if its reservation write failed.
  // Those receipts are no longer in the PENDING query, hence the persisted repair flag.
  const repairPayments = await collectAllPages(async (offset, limit) => {
    const result = await elevatedFind(
      items.query(PAYMENTS)
        .eq('status', 'PAID')
        .eq('wixOnlinePayment', true)
        .eq('balanceSyncPending', true)
        .skip(offset)
        .limit(limit),
    );
    return (result.items || []) as Payment[];
  }, 100);

  let repaired = 0;
  for (const payment of repairPayments) {
    if (!payment._id || !payment.reservationId) continue;
    try {
      const balanceDueCents = await syncReservationBalance(payment.reservationId);
      await elevatedUpdate(PAYMENTS, {
        ...payment,
        remainingBalanceCents: balanceDueCents,
        balanceSyncPending: false,
      });
      repaired += 1;
    } catch (error) {
      console.error('RentalFlow could not repair a verified payment balance.', error);
    }
  }

  return {
    checked: pending.length,
    updated,
    repaired,
    repairPending: repairPayments.length - repaired,
  };
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

