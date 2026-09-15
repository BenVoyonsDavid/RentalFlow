import type { CSSProperties, FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { items } from '@wix/data';
import { Page, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import { catalogItemAppliesToAnyAsset } from '../../../../lib/catalog-compatibility';
import {
  catalogBillableDays,
  catalogItemToReservationLine,
  computeReservationFinancials,
  reservationLineType,
  type CatalogReservationItem,
  type ReservationCatalogLine,
} from '../../../../lib/reservation-catalog';
import { useRentalFlowI18n } from '../../../../intl';

const ASSETS = '@pilotedavid1/rental-flow/assets';
const CATALOG = '@pilotedavid1/rental-flow/catalog-items';
const RESERVATIONS = '@pilotedavid1/rental-flow/reservations';
const RESERVATION_ITEMS = '@pilotedavid1/rental-flow/reservation-items';
const PAYMENTS = '@pilotedavid1/rental-flow/payments';
const SETTINGS = '@pilotedavid1/rental-flow/app-settings';
const ACTIVITY = '@pilotedavid1/rental-flow/activity-log';

type Reservation = {
  _id?: string;
  reservationNumber?: string;
  customerName?: string;
  startDateTime?: Date | string;
  endDateTime?: Date | string;
  status?: string;
  currency?: string;
  customerDiscountPercent?: number;
  subtotalCents?: number;
  discountCents?: number;
  preTaxTotalCents?: number;
  tax1Name?: string;
  tax1Rate?: number;
  tax1Cents?: number;
  tax2Name?: string;
  tax2Rate?: number;
  tax2Cents?: number;
  taxTotalCents?: number;
  totalCents?: number;
  depositAmountCents?: number;
  amountDueNowCents?: number;
  balanceDueCents?: number;
  _createdDate?: Date | string;
  _updatedDate?: Date | string;
  [key: string]: unknown;
};

type ReservationItem = ReservationCatalogLine & {
  reservationId?: string;
  reservationNumber?: string;
  assetId?: string;
  assetNumber?: string;
  assetTitle?: string;
  startDateTime?: Date | string;
  endDateTime?: Date | string;
  blockedStartDateTime?: Date | string;
  blockedEndDateTime?: Date | string;
  bufferBeforeHours?: number;
  bufferAfterHours?: number;
  status?: string;
};

type Asset = {
  _id?: string;
  title?: string;
  assetNumber?: string;
  productType?: string;
  catalogTagsJson?: string;
};

type Payment = {
  reservationId?: string;
  paymentType?: string;
  status?: string;
  amountCents?: number;
};

type AppSettings = {
  settingsKey?: string;
  currency?: string;
  taxesEnabled?: boolean;
  tax1Name?: string;
  tax1Rate?: number;
  tax2Name?: string;
  tax2Rate?: number;
  tax2Compound?: boolean;
};

const card: CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,.06)',
};
const primary: CSSProperties = {
  border: 0, borderRadius: 8, padding: '9px 14px', fontSize: 14, fontWeight: 600,
  cursor: 'pointer', background: '#116dff', color: '#fff',
};
const secondary: CSSProperties = {
  ...primary, border: '1px solid #116dff', background: '#fff', color: '#116dff',
};
const danger: CSSProperties = {
  ...secondary, borderColor: '#dc2626', color: '#b91c1c',
};
const input: CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8,
  padding: '9px 11px', fontSize: 14, background: '#fff',
};

function asDate(value?: Date | string): Date {
  if (value instanceof Date) return value;
  return value ? new Date(value) : new Date(0);
}

function reservationUpdatePayload(reservation: Reservation, changes: Partial<Reservation>) {
  const { _createdDate, _updatedDate, ...rest } = reservation;
  return { ...rest, _id: reservation._id, ...changes };
}

function netPaidCents(payments: Payment[], reservationId: string): number {
  return payments
    .filter((payment) => payment.reservationId === reservationId && payment.status === 'PAID')
    .reduce((sum, payment) => {
      const amount = Math.max(0, Math.round(payment.amountCents || 0));
      if (payment.paymentType === 'PAYMENT' || payment.paymentType === 'BOOKING_DEPOSIT') return sum + amount;
      if (payment.paymentType === 'REFUND') return sum - amount;
      return sum;
    }, 0);
}

const ReservationExtrasPage: FC = () => {
  const { locale, t } = useRentalFlowI18n('dashboard');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationItems, setReservationItems] = useState<ReservationItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogReservationItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ currency: 'CAD', taxesEnabled: true });
  const [selectedReservationId, setSelectedReservationId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const money = useCallback((cents = 0, currency = 'CAD') => (
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
  ), [locale]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [reservationResult, itemResult, catalogResult, assetResult, paymentResult, settingsResult] = await Promise.all([
        items.query(RESERVATIONS).limit(1000).find(),
        items.query(RESERVATION_ITEMS).limit(1000).find(),
        items.query(CATALOG).limit(1000).find(),
        items.query(ASSETS).limit(1000).find(),
        items.query(PAYMENTS).limit(1000).find(),
        items.query(SETTINGS).eq('settingsKey', 'default').limit(1).find(),
      ]);
      setReservations(reservationResult.items as Reservation[]);
      setReservationItems(itemResult.items as ReservationItem[]);
      setCatalog(catalogResult.items as CatalogReservationItem[]);
      setAssets(assetResult.items as Asset[]);
      setPayments(paymentResult.items as Payment[]);
      setSettings({ currency: 'CAD', taxesEnabled: true, ...((settingsResult.items[0] as AppSettings | undefined) || {}) });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Impossible de charger les données.', 'Unable to load data.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const selectableReservations = useMemo(() => [...reservations]
    .filter((reservation) => reservation._id && reservation.status !== 'CANCELLED' && reservation.status !== 'COMPLETED' && reservation.status !== 'ERROR')
    .sort((a, b) => asDate(b.startDateTime).getTime() - asDate(a.startDateTime).getTime()), [reservations]);

  const selectedReservation = useMemo(
    () => reservations.find((reservation) => reservation._id === selectedReservationId),
    [reservations, selectedReservationId],
  );

  const linkedLines = useMemo(
    () => reservationItems.filter((line) => line.reservationId === selectedReservationId),
    [reservationItems, selectedReservationId],
  );
  const rentalLines = useMemo(
    () => linkedLines.filter((line) => reservationLineType(line) === 'RENTAL'),
    [linkedLines],
  );
  const catalogLines = useMemo(
    () => linkedLines.filter((line) => reservationLineType(line) !== 'RENTAL'),
    [linkedLines],
  );

  const rentalAssets = useMemo(() => {
    const ids = new Set(rentalLines.map((line) => line.assetId).filter(Boolean));
    return assets.filter((asset) => asset._id && ids.has(asset._id));
  }, [assets, rentalLines]);

  const compatibleCatalog = useMemo(() => catalog
    .filter((item) => item.active !== false && item._id)
    .filter((item) => rentalAssets.length > 0 && catalogItemAppliesToAnyAsset(item as any, rentalAssets)),
    [catalog, rentalAssets],
  );

  const billableDays = useMemo(() => {
    const rentalDays = rentalLines.reduce((max, line) => Math.max(max, line.billableDays || 0), 0);
    if (rentalDays > 0) return rentalDays;
    return catalogBillableDays(selectedReservation?.startDateTime, selectedReservation?.endDateTime);
  }, [rentalLines, selectedReservation]);

  const paidCents = selectedReservation?._id ? Math.max(0, netPaidCents(payments, selectedReservation._id)) : 0;

  const recalculateReservation = async (reservation: Reservation, nextLines: ReservationItem[]) => {
    if (!reservation._id) return reservation;
    const finance = computeReservationFinancials(nextLines, reservation.customerDiscountPercent || 0, settings);
    const totalCents = finance.totalCents;
    const nextBalance = Math.max(0, totalCents - Math.max(0, netPaidCents(payments, reservation._id)));
    const updated = await items.update(RESERVATIONS, reservationUpdatePayload(reservation, {
      subtotalCents: finance.subtotalCents,
      discountCents: finance.discountCents,
      preTaxTotalCents: finance.preTaxTotalCents,
      tax1Cents: finance.tax1Cents,
      tax2Cents: finance.tax2Cents,
      taxTotalCents: finance.taxTotalCents,
      totalCents,
      depositAmountCents: Math.min(reservation.depositAmountCents || 0, totalCents),
      amountDueNowCents: Math.min(reservation.amountDueNowCents || 0, totalCents),
      balanceDueCents: nextBalance,
    })) as Reservation;
    return updated;
  };

  const logActivity = async (reservation: Reservation, description: string) => {
    if (!reservation._id) return;
    try {
      await items.insert(ACTIVITY, {
        reservationId: reservation._id,
        reservationNumber: reservation.reservationNumber || '',
        actionType: 'CATALOG_ITEMS_UPDATED',
        description,
        actor: 'Utilisateur Wix',
        eventDate: new Date(),
      });
    } catch {
      // Logging must not block catalog changes.
    }
  };

  const addCatalogItem = async (item: CatalogReservationItem) => {
    if (!selectedReservation?._id || !item._id) return;
    if (selectedReservation.status === 'CANCELLED' || selectedReservation.status === 'COMPLETED') return;
    setProcessing(true); setError(''); setSuccess('');
    try {
      const existing = catalogLines.find((line) => line.catalogItemId === item._id);
      if (existing && (item.pricingMode === 'FIXED' || item.pricingMode === 'PER_RESERVATION')) {
        throw new Error(t('Cet article est déjà présent sur la réservation.', 'This item is already on the reservation.'));
      }

      const requestedQuantity = Math.max(1, Math.floor(quantities[item._id] || 1));
      const currentQuantity = existing?.quantity || 0;
      const nextQuantity = existing ? currentQuantity + requestedQuantity : requestedQuantity;
      if (item.trackInventory && typeof item.stockQuantity === 'number' && nextQuantity > item.stockQuantity) {
        throw new Error(t('La quantité demandée dépasse le stock disponible.', 'Requested quantity exceeds available stock.'));
      }

      const lineSnapshot = catalogItemToReservationLine(item, nextQuantity, billableDays, selectedReservation.currency || settings.currency || 'CAD');
      let nextLines: ReservationItem[];

      if (existing?._id) {
        const updatedLine = await items.update(RESERVATION_ITEMS, {
          ...existing,
          _id: existing._id,
          ...lineSnapshot,
          reservationId: selectedReservation._id,
          reservationNumber: selectedReservation.reservationNumber || '',
          startDateTime: selectedReservation.startDateTime,
          endDateTime: selectedReservation.endDateTime,
          status: selectedReservation.status || 'CONFIRMED',
        }) as ReservationItem;
        nextLines = linkedLines.map((line) => line._id === existing._id ? updatedLine : line);
      } else {
        const createdLine = await items.insert(RESERVATION_ITEMS, {
          ...lineSnapshot,
          reservationId: selectedReservation._id,
          reservationNumber: selectedReservation.reservationNumber || '',
          startDateTime: selectedReservation.startDateTime,
          endDateTime: selectedReservation.endDateTime,
          status: selectedReservation.status || 'CONFIRMED',
        }) as ReservationItem;
        nextLines = [...linkedLines, createdLine];
      }

      await recalculateReservation(selectedReservation, nextLines);
      await logActivity(selectedReservation, `${item.name || 'Article'} ${t('ajouté à la réservation', 'added to reservation')}.`);
      setSuccess(`${item.name || t('Article', 'Item')} — ${t('ajouté', 'added')}.`);
      setQuantities((current) => ({ ...current, [item._id!]: 1 }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Impossible d’ajouter cet article.', 'Unable to add this item.'));
    } finally {
      setProcessing(false);
    }
  };

  const removeCatalogLine = async (line: ReservationItem) => {
    if (!selectedReservation?._id || !line._id) return;
    if (!window.confirm(t(`Retirer ${line.itemName || 'cet article'} de la réservation ?`, `Remove ${line.itemName || 'this item'} from the reservation?`))) return;
    setProcessing(true); setError(''); setSuccess('');
    try {
      await items.remove(RESERVATION_ITEMS, line._id);
      const nextLines = linkedLines.filter((candidate) => candidate._id !== line._id);
      await recalculateReservation(selectedReservation, nextLines);
      await logActivity(selectedReservation, `${line.itemName || 'Article'} ${t('retiré de la réservation', 'removed from reservation')}.`);
      setSuccess(`${line.itemName || t('Article', 'Item')} — ${t('retiré', 'removed')}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Impossible de retirer cet article.', 'Unable to remove this item.'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header
          title={t('Extras de réservation', 'Reservation Extras')}
          subtitle={t(
            'Ajoutez des produits, extras et services à une réservation existante sans recréer l’article pour chaque équipement.',
            'Add products, extras and services to an existing reservation without recreating the item for every asset.',
          )}
        />
        <Page.Content>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 50 }}>
            {error && <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>{error}</div>}
            {success && <div style={{ ...card, background: '#f0fdf4', borderColor: '#86efac', color: '#166534' }}>{success}</div>}

            <div style={card}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: 7 }}>{t('Réservation', 'Reservation')}</label>
              <select style={input} disabled={loading || processing} value={selectedReservationId} onChange={(event) => { setSelectedReservationId(event.target.value); setError(''); setSuccess(''); }}>
                <option value="">{loading ? t('Chargement…', 'Loading…') : t('Sélectionner une réservation…', 'Select a reservation…')}</option>
                {selectableReservations.map((reservation) => (
                  <option key={reservation._id} value={reservation._id}>
                    {reservation.reservationNumber || '—'} · {reservation.customerName || '—'} · {asDate(reservation.startDateTime).toLocaleDateString(locale)}
                  </option>
                ))}
              </select>
            </div>

            {selectedReservation && (
              <>
                <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
                  <Metric label={t('Réservation', 'Reservation')} value={selectedReservation.reservationNumber || '—'} />
                  <Metric label={t('Client', 'Customer')} value={selectedReservation.customerName || '—'} />
                  <Metric label={t('Durée facturée', 'Billable duration')} value={`${billableDays} ${t('jour(s)', 'day(s)')}`} />
                  <Metric label={t('Total', 'Total')} value={money(selectedReservation.totalCents || 0, selectedReservation.currency || settings.currency || 'CAD')} />
                  <Metric label={t('Déjà payé', 'Already paid')} value={money(paidCents, selectedReservation.currency || settings.currency || 'CAD')} />
                  <Metric label={t('Solde', 'Balance')} value={money(selectedReservation.balanceDueCents || 0, selectedReservation.currency || settings.currency || 'CAD')} />
                </div>

                <div style={card}>
                  <h2 style={{ marginTop: 0 }}>{t('Équipements de la réservation', 'Rental equipment')}</h2>
                  {rentalAssets.length === 0 ? (
                    <div style={{ color: '#64748b' }}>{t('Aucun équipement trouvé sur cette réservation.', 'No rental equipment found on this reservation.')}</div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {rentalAssets.map((asset) => <span key={asset._id} style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 999, padding: '7px 10px', fontSize: 13, fontWeight: 600 }}>{asset.title || asset.assetNumber}</span>)}
                    </div>
                  )}
                </div>

                <div style={card}>
                  <h2 style={{ marginTop: 0 }}>{t('Déjà ajoutés', 'Already added')}</h2>
                  {catalogLines.length === 0 ? (
                    <div style={{ color: '#64748b' }}>{t('Aucun produit ou extra ajouté.', 'No products or extras added.')}</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {catalogLines.map((line) => (
                        <div key={line._id} style={{ border: '1px solid #e5e7eb', borderRadius: 9, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <div>
                            <strong>{line.itemName || line.sku || t('Article', 'Item')}</strong>
                            <div style={{ color: '#64748b', fontSize: 13, marginTop: 3 }}>
                              {reservationLineType(line)} · {t('Qté', 'Qty')} {line.quantity || 1} · {line.pricingMode || 'FIXED'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <strong>{money(line.lineTotalCents || 0, line.currency || selectedReservation.currency || 'CAD')}</strong>
                            <button style={danger} disabled={processing} onClick={() => void removeCatalogLine(line)}>{t('Retirer', 'Remove')}</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={card}>
                  <h2 style={{ marginTop: 0 }}>{t('Catalogue compatible', 'Compatible catalog')}</h2>
                  <div style={{ color: '#64748b', marginBottom: 16 }}>
                    {t(
                      'Les articles ci-dessous sont déterminés automatiquement à partir des catégories, tags et équipements de la réservation.',
                      'Items below are selected automatically from the reservation’s categories, tags and assets.',
                    )}
                  </div>
                  {compatibleCatalog.length === 0 ? (
                    <div style={{ color: '#64748b' }}>{t('Aucun article compatible actif.', 'No active compatible items.')}</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))', gap: 12 }}>
                      {compatibleCatalog.map((item) => {
                        const already = catalogLines.find((line) => line.catalogItemId === item._id);
                        const fixedOnce = item.pricingMode === 'FIXED' || item.pricingMode === 'PER_RESERVATION';
                        const quantity = Math.max(1, quantities[item._id!] || 1);
                        const outOfStock = item.trackInventory === true && typeof item.stockQuantity === 'number' && item.stockQuantity <= 0;
                        return (
                          <div key={item._id} style={{ border: `1px solid ${item.required ? '#f59e0b' : item.recommended ? '#a78bfa' : '#e5e7eb'}`, borderRadius: 10, padding: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                              <div>
                                <strong>{item.name || t('Article', 'Item')}</strong>
                                <div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>{item.sku || item.itemType || ''}</div>
                              </div>
                              <strong>{money(item.priceCents || 0, item.currency || selectedReservation.currency || 'CAD')}</strong>
                            </div>
                            {item.description ? <div style={{ color: '#475569', marginTop: 8, fontSize: 13 }}>{item.description}</div> : null}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                              {item.required ? <Badge>{t('Obligatoire', 'Required')}</Badge> : null}
                              {item.recommended ? <Badge>{t('Recommandé', 'Recommended')}</Badge> : null}
                              <Badge>{item.pricingMode || 'FIXED'}</Badge>
                              {item.trackInventory ? <Badge>{t(`Stock ${item.stockQuantity ?? 0}`, `Stock ${item.stockQuantity ?? 0}`)}</Badge> : null}
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                              {!fixedOnce && <input aria-label={t('Quantité', 'Quantity')} type="number" min="1" step="1" style={{ ...input, width: 84 }} value={quantity} onChange={(event) => setQuantities((current) => ({ ...current, [item._id!]: Math.max(1, Math.floor(Number(event.target.value) || 1)) }))} />}
                              <button style={{ ...primary, flex: 1, opacity: outOfStock || (fixedOnce && !!already) ? .5 : 1 }} disabled={processing || outOfStock || (fixedOnce && !!already)} onClick={() => void addCatalogItem(item)}>
                                {fixedOnce && already ? t('Déjà ajouté', 'Already added') : t('Ajouter', 'Add')}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </Page.Content>
      </Page>
    </WixDesignSystemProvider>
  );
};

const Metric: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ background: '#f8fafc', borderRadius: 9, padding: 12 }}>
    <div style={{ color: '#64748b', fontSize: 12 }}>{label}</div>
    <div style={{ marginTop: 4, fontWeight: 700 }}>{value}</div>
  </div>
);

const Badge: FC<{ children: string }> = ({ children }) => (
  <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 700 }}>{children}</span>
);

export default ReservationExtrasPage;
