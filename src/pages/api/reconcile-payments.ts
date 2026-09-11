import type { APIRoute } from 'astro';
import { items } from '@wix/data';
import { auth } from '@wix/essentials';

const PAYMENTS = '@pilotedavid1/rental-flow/payments';
const RESERVATIONS = '@pilotedavid1/rental-flow/reservations';
const ACTIVITY = '@pilotedavid1/rental-flow/activity-log';

type LocalPayment = {
  _id?: string;
  reservationId?: string;
  reservationNumber?: string;
  paymentNumber?: string;
  status?: string;
  amountCents?: number;
  currency?: string;
  paymentDate?: Date | string;
  wixPaymentLinkId?: string;
  wixTransactionId?: string;
  wixOnlinePayment?: boolean;
  remainingBalanceCents?: number;
  notes?: string;
};

type Reservation = {
  _id?: string;
  reservationNumber?: string;
  totalCents?: number;
  balanceDueCents?: number;
  workflowStage?: string;
  status?: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function requireAppInstance(): Promise<void> {
  const tokenInfo = await auth.getTokenInfo();
  if (!tokenInfo?.instanceId) throw new Error('UNAUTHORIZED');
}

async function elevatedFind(query: any): Promise<any> {
  const run = auth.elevate(query.find.bind(query));
  return run();
}

async function elevatedUpdate(collectionId: string, item: Record<string, unknown>): Promise<any> {
  const update = auth.elevate(items.update);
  return update(collectionId, item);
}

async function elevatedInsert(collectionId: string, item: Record<string, unknown>): Promise<any> {
  const insert = auth.elevate(items.insert);
  return insert(collectionId, item);
}

function asCents(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Wix Money amounts are normally decimal major units.
    return Math.max(0, Math.round(value * 100));
  }
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

async function syncReservationBalance(reservationId: string): Promise<number> {
  const [reservationResult, paymentsResult] = await Promise.all([
    elevatedFind(items.query(RESERVATIONS).eq('_id', reservationId).limit(1)),
    elevatedFind(items.query(PAYMENTS).eq('reservationId', reservationId).limit(100)),
  ]);

  const reservation = reservationResult.items?.[0] as Reservation | undefined;
  if (!reservation?._id) return 0;

  const paid = (paymentsResult.items as LocalPayment[])
    .filter((payment) => payment.status === 'PAID')
    .reduce((sum, payment) => sum + Math.max(0, payment.amountCents || 0), 0);
  const balanceDueCents = Math.max(0, (reservation.totalCents || 0) - paid);

  await elevatedUpdate(RESERVATIONS, {
    ...reservation,
    balanceDueCents,
    workflowStage: balanceDueCents === 0 && reservation.workflowStage === 'PAYMENT'
      ? 'READY'
      : reservation.workflowStage,
  });

  return balanceDueCents;
}

async function reconcilePendingPayments(): Promise<{ checked: number; updated: number }> {
  const pendingResult = await elevatedFind(
    items.query(PAYMENTS)
      .eq('status', 'PENDING')
      .eq('wixOnlinePayment', true)
      .limit(100)
  );
  const pending = pendingResult.items as LocalPayment[];
  if (!pending.length) return { checked: 0, updated: 0 };

  const wixGetPaid = await import('@wix/get-paid') as any;
  const paymentLinksApi = wixGetPaid.paymentLinks;
  if (!paymentLinksApi?.getPaymentLink) throw new Error('GET_PAYMENT_LINK_UNAVAILABLE');
  const getPaymentLink = auth.elevate(paymentLinksApi.getPaymentLink);

  let updated = 0;

  for (const payment of pending) {
    if (!payment._id || !payment.wixPaymentLinkId) continue;

    try {
      const response = await getPaymentLink(payment.wixPaymentLinkId);
      const link = response?.paymentLink || response;
      const status = String(link?.status || '').toUpperCase();
      const receivedCount = Number(link?.totalReceived?.paymentCount || 0);
      const isPaid = status === 'PAID' || receivedCount > 0;
      if (!isPaid) continue;

      const receivedAmountCents = asCents(link?.totalReceived?.amount);
      const amountCents = receivedAmountCents > 0 ? Math.min(receivedAmountCents, payment.amountCents || receivedAmountCents) : payment.amountCents || 0;
      const transactionId = String(
        link?.lastTransactionId ||
        link?.transactionId ||
        payment.wixTransactionId ||
        ''
      );

      await elevatedUpdate(PAYMENTS, {
        ...payment,
        status: 'PAID',
        amountCents,
        paymentDate: link?.lastPaymentDate ? new Date(link.lastPaymentDate) : payment.paymentDate || new Date(),
        wixTransactionId: transactionId,
        notes: [payment.notes, 'Paiement confirmé automatiquement depuis Wix Payment Links.'].filter(Boolean).join(' '),
      });

      let balanceDueCents = payment.remainingBalanceCents || 0;
      if (payment.reservationId) balanceDueCents = await syncReservationBalance(payment.reservationId);

      await elevatedInsert(ACTIVITY, {
        reservationId: payment.reservationId || '',
        reservationNumber: payment.reservationNumber || '',
        actionType: 'ONLINE_PAYMENT_CONFIRMED',
        description: `Paiement Wix ${payment.paymentNumber || ''} confirmé${amountCents ? ` pour ${(amountCents / 100).toFixed(2)} ${payment.currency || ''}` : ''}.`,
        actor: 'RentalFlow Payment Sync',
        eventDate: new Date(),
      });

      if (payment._id) {
        await elevatedUpdate(PAYMENTS, {
          ...payment,
          status: 'PAID',
          amountCents,
          paymentDate: link?.lastPaymentDate ? new Date(link.lastPaymentDate) : payment.paymentDate || new Date(),
          wixTransactionId: transactionId,
          remainingBalanceCents: balanceDueCents,
          notes: [payment.notes, 'Paiement confirmé automatiquement depuis Wix Payment Links.'].filter(Boolean).join(' '),
        });
      }

      updated += 1;
    } catch (error) {
      console.error(`RentalFlow could not reconcile payment ${payment.paymentNumber || payment._id || ''}.`, error);
    }
  }

  return { checked: pending.length, updated };
}

export const POST: APIRoute = async () => {
  try {
    await requireAppInstance();
    return json(await reconcilePendingPayments());
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return json({ error: 'Unauthorized' }, 401);
    console.error('RentalFlow payment reconciliation failed', error);
    return json({ error: 'Impossible de synchroniser les paiements Wix.' }, 500);
  }
};
