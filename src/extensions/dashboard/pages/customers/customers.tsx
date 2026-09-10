import type { CSSProperties, FC, FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { items } from '@wix/data';
import { Page, WixDesignSystemProvider } from '@wix/design-system';
import '@wix/design-system/styles.global.css';

const CUSTOMERS = '@pilotedavid1/rental-flow/customers';
const RESERVATIONS = '@pilotedavid1/rental-flow/reservations';

type Customer = {
  _id?: string;
  customerNumber?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  discountPercent?: number;
  notes?: string;
  active?: boolean;
  _createdDate?: Date | string;
  _updatedDate?: Date | string;
};

type Reservation = {
  _id?: string;
  reservationNumber?: string;
  customerId?: string;
  customerEmail?: string;
  startDateTime?: Date | string;
  endDateTime?: Date | string;
  totalCents?: number;
  currency?: string;
  status?: string;
};

type CustomerForm = {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  discountPercent: string;
  notes: string;
};

const blankForm: CustomerForm = {
  firstName: '', lastName: '', companyName: '', email: '', phone: '', addressLine1: '',
  addressLine2: '', city: '', region: 'QC', postalCode: '', country: 'Canada', discountPercent: '0', notes: '',
};

const card: CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
  padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.06)',
};
const primary: CSSProperties = {
  border: 0, borderRadius: 8, padding: '10px 16px', fontSize: 14,
  fontWeight: 600, cursor: 'pointer', background: '#116dff', color: '#fff',
};
const secondary: CSSProperties = {
  ...primary, border: '1px solid #116dff', background: '#fff', color: '#116dff',
};
const danger: CSSProperties = {
  ...secondary, borderColor: '#dc2626', color: '#b91c1c',
};
const input: CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1',
  borderRadius: 8, padding: '10px 12px', fontSize: 14, background: '#fff',
};

function customerNumber(): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `C-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
}
function fullName(customer: Customer): string {
  const person = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  return person || customer.companyName || 'Client sans nom';
}
function money(cents = 0, currency = 'CAD'): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency }).format(cents / 100);
}
function dateTime(value?: Date | string): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

const CustomersPage: FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<CustomerForm>(blankForm);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [customerResult, reservationResult] = await Promise.all([
        items.query(CUSTOMERS).limit(1000).find(),
        items.query(RESERVATIONS).limit(1000).find(),
      ]);
      setCustomers(customerResult.items as Customer[]);
      setReservations(reservationResult.items as Reservation[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les clients.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const linkedReservations = useCallback((customer: Customer) => {
    const email = customer.email?.trim().toLowerCase();
    return reservations.filter((reservation) =>
      (customer._id && reservation.customerId === customer._id) ||
      (!!email && reservation.customerEmail?.trim().toLowerCase() === email)
    );
  }, [reservations]);

  const customerStats = useCallback((customer: Customer) => {
    const linked = linkedReservations(customer);
    return {
      count: linked.length,
      revenue: linked
        .filter((reservation) => reservation.status !== 'CANCELLED' && reservation.status !== 'ERROR')
        .reduce((sum, reservation) => sum + (reservation.totalCents || 0), 0),
    };
  }, [linkedReservations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter((customer) => showInactive || customer.active !== false)
      .filter((customer) => !q || [customer.customerNumber, customer.firstName, customer.lastName, customer.companyName, customer.email, customer.phone]
        .some((value) => value?.toLowerCase().includes(q)))
      .sort((a, b) => fullName(a).localeCompare(fullName(b), 'fr'));
  }, [customers, search, showInactive]);

  const stats = useMemo(() => ({
    active: customers.filter((customer) => customer.active !== false).length,
    reservations: reservations.length,
    revenue: reservations
      .filter((reservation) => reservation.status !== 'CANCELLED' && reservation.status !== 'ERROR')
      .reduce((sum, reservation) => sum + (reservation.totalCents || 0), 0),
  }), [customers, reservations]);

  const add = () => {
    setEditing(null); setForm(blankForm); setFormError(''); setFormOpen(true);
  };

  const edit = (customer: Customer) => {
    setDetailCustomer(null);
    setEditing(customer);
    setForm({
      firstName: customer.firstName || '', lastName: customer.lastName || '', companyName: customer.companyName || '',
      email: customer.email || '', phone: customer.phone || '', addressLine1: customer.addressLine1 || '',
      addressLine2: customer.addressLine2 || '', city: customer.city || '', region: customer.region || '',
      postalCode: customer.postalCode || '', country: customer.country || 'Canada',
      discountPercent: String(customer.discountPercent || 0), notes: customer.notes || '',
    });
    setFormError(''); setFormOpen(true);
  };

  const closeForm = () => {
    if (!saving) { setFormOpen(false); setEditing(null); setFormError(''); }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFormError(''); setSuccess('');
    if (!form.firstName.trim() && !form.lastName.trim() && !form.companyName.trim()) {
      return setFormError('Entrez un nom de personne ou un nom d’entreprise.');
    }

    const email = form.email.trim().toLowerCase();
    if (email && customers.some((customer) => customer._id !== editing?._id && customer.email?.trim().toLowerCase() === email)) {
      return setFormError('Un client avec ce courriel existe déjà.');
    }

    const discountPercent = Number(form.discountPercent.replace(',', '.'));
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return setFormError('Le rabais client doit être entre 0 et 100 %.');
    }

    setSaving(true);
    try {
      const data: Customer = {
        customerNumber: editing?.customerNumber || customerNumber(),
        firstName: form.firstName.trim(), lastName: form.lastName.trim(), companyName: form.companyName.trim(),
        email, phone: form.phone.trim(), addressLine1: form.addressLine1.trim(), addressLine2: form.addressLine2.trim(),
        city: form.city.trim(), region: form.region.trim(), postalCode: form.postalCode.trim().toUpperCase(),
        country: form.country.trim(), discountPercent, notes: form.notes.trim(), active: editing?.active !== false,
      };
      if (editing?._id) await items.update(CUSTOMERS, { _id: editing._id, ...data });
      else await items.insert(CUSTOMERS, data);
      setSuccess(`${fullName(data)} a été ${editing ? 'modifié' : 'ajouté'}.`);
      setFormOpen(false); setEditing(null); setForm(blankForm); await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Impossible d’enregistrer le client.');
    } finally { setSaving(false); }
  };

  const toggleActive = async (customer: Customer, ask = true) => {
    if (!customer._id) return;
    const next = customer.active === false;
    if (ask && !next && !window.confirm(`Désactiver ${fullName(customer)} ? Son historique sera conservé.`)) return;
    setError(''); setSuccess('');
    try {
      await items.update(CUSTOMERS, { ...customer, active: next });
      setSuccess(next ? `${fullName(customer)} a été réactivé.` : `${fullName(customer)} a été désactivé.`);
      setDetailCustomer(null); await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de modifier le statut du client.');
    }
  };

  const removeCustomer = async (customer: Customer) => {
    if (!customer._id) return;
    const linked = linkedReservations(customer);
    if (linked.length > 0) {
      const deactivate = window.confirm(
        `${fullName(customer)} possède ${linked.length} réservation(s). La fiche ne peut pas être supprimée sans perdre le lien historique.\n\nVoulez-vous désactiver ce client plutôt ?`
      );
      if (deactivate && customer.active !== false) await toggleActive(customer, false);
      return;
    }
    if (!window.confirm(`Supprimer définitivement la fiche de ${fullName(customer)} ? Cette action est irréversible.`)) return;
    setError(''); setSuccess('');
    try {
      await items.remove(CUSTOMERS, customer._id);
      setSuccess(`${fullName(customer)} a été supprimé définitivement.`);
      setDetailCustomer(null); await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de supprimer le client.');
    }
  };

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header title="Clients" subtitle="Consultez, modifiez et gérez les fiches clients et leur historique de location." />
        <Page.Content>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(150px,1fr))', gap: 10, flex: 1 }}>
                <Stat label="Clients actifs" value={String(stats.active)} />
                <Stat label="Réservations" value={String(stats.reservations)} />
                <Stat label="Revenus réservés" value={money(stats.revenue)} />
              </div>
              <button style={primary} onClick={add}>+ Nouveau client</button>
            </div>

            {success && <div style={{ ...card, background: '#f0fdf4', borderColor: '#86efac', color: '#166534' }}>{success}</div>}
            {error && <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>{error}</div>}

            <div style={card}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
                <input style={{ ...input, maxWidth: 420 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher nom, entreprise, courriel, téléphone…" />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Afficher les inactifs</label>
              </div>

              {loading ? <div>Chargement…</div> : filtered.length === 0 ? (
                <div style={{ padding: 36, textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 10 }}>Aucun client à afficher.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1040 }}>
                    <thead><tr style={{ textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: 10 }}>Client</th><th>No client</th><th>Coordonnées</th><th>Réservations</th><th>Revenus</th><th>Rabais</th><th style={{ textAlign: 'right' }}>Actions</th>
                    </tr></thead>
                    <tbody>{filtered.map((customer) => {
                      const summary = customerStats(customer);
                      return <tr key={customer._id || customer.customerNumber} style={{ borderTop: '1px solid #e5e7eb', opacity: customer.active === false ? .6 : 1 }}>
                        <td style={{ padding: 12 }}><strong>{fullName(customer)}</strong>{customer.companyName && (customer.firstName || customer.lastName) ? <div style={{ color: '#64748b', marginTop: 3 }}>{customer.companyName}</div> : null}</td>
                        <td>{customer.customerNumber || '—'}</td>
                        <td><div>{customer.email || '—'}</div><div style={{ color: '#64748b', marginTop: 3 }}>{customer.phone || ''}</div></td>
                        <td>{summary.count}</td><td>{money(summary.revenue)}</td><td>{customer.discountPercent || 0} %</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button style={{ ...secondary, padding: '7px 10px', marginRight: 6 }} onClick={() => setDetailCustomer(customer)}>Voir</button>
                          <button style={{ ...secondary, padding: '7px 10px', marginRight: 6 }} onClick={() => edit(customer)}>Modifier</button>
                          <button style={{ ...danger, padding: '7px 10px' }} onClick={() => void removeCustomer(customer)}>Supprimer</button>
                        </td>
                      </tr>;
                    })}</tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Page.Content>
      </Page>

      {detailCustomer && <CustomerDetail customer={detailCustomer} reservations={linkedReservations(detailCustomer)} onClose={() => setDetailCustomer(null)} onEdit={() => edit(detailCustomer)} onToggle={() => void toggleActive(detailCustomer)} onDelete={() => void removeCustomer(detailCustomer)} />}

      {formOpen && (
        <div onMouseDown={closeForm} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
          <div onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 900, maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 14 }}>
            <form onSubmit={save}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
                <div><h2 style={{ margin: 0 }}>{editing ? 'Modifier le client' : 'Nouveau client'}</h2><div style={{ color: '#64748b', marginTop: 4 }}>{editing?.customerNumber || 'Le numéro client sera généré automatiquement.'}</div></div>
                <button type="button" onClick={closeForm} disabled={saving} style={{ border: 0, background: 'transparent', fontSize: 26 }}>×</button>
              </div>
              <div style={{ padding: 24 }}>
                {formError && <div style={{ background: '#fef2f2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 18 }}>{formError}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
                  <Field label="Prénom"><input style={input} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
                  <Field label="Nom"><input style={input} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
                  <Field label="Entreprise"><input style={input} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></Field>
                  <Field label="Courriel"><input type="email" style={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                  <Field label="Téléphone"><input style={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                  <Field label="Rabais permanent (%)"><input type="number" min="0" max="100" step="0.1" style={input} value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} /></Field>
                  <Field label="Adresse"><input style={input} value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} /></Field>
                  <Field label="Adresse 2"><input style={input} value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} /></Field>
                  <Field label="Ville"><input style={input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
                  <Field label="Province / État"><input style={input} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></Field>
                  <Field label="Code postal"><input style={input} value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></Field>
                  <Field label="Pays"><input style={input} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
                </div>
                <div style={{ marginTop: 16 }}><Field label="Notes"><textarea style={{ ...input, minHeight: 100 }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" style={secondary} onClick={closeForm} disabled={saving}>Annuler</button>
                <button type="submit" style={primary} disabled={saving}>{saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer le client'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </WixDesignSystemProvider>
  );
};

const CustomerDetail: FC<{
  customer: Customer;
  reservations: Reservation[];
  onClose: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}> = ({ customer, reservations, onClose, onEdit, onToggle, onDelete }) => {
  const revenue = reservations.filter((r) => r.status !== 'CANCELLED' && r.status !== 'ERROR').reduce((sum, r) => sum + (r.totalCents || 0), 0);
  return <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
    <div onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 920, maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 14 }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div><h2 style={{ margin: 0 }}>{fullName(customer)}</h2><div style={{ color: '#64748b', marginTop: 4 }}>{customer.customerNumber || 'Client'} · {customer.active === false ? 'Inactif' : 'Actif'}</div></div>
        <button type="button" onClick={onClose} style={{ border: 0, background: 'transparent', fontSize: 26 }}>×</button>
      </div>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          <Stat label="Réservations" value={String(reservations.length)} />
          <Stat label="Revenus" value={money(revenue)} />
          <Stat label="Rabais permanent" value={`${customer.discountPercent || 0} %`} />
        </div>
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Coordonnées</h3>
          <Info label="Courriel" value={customer.email || '—'} /><Info label="Téléphone" value={customer.phone || '—'} />
          <Info label="Adresse" value={[customer.addressLine1, customer.addressLine2, customer.city, customer.region, customer.postalCode, customer.country].filter(Boolean).join(', ') || '—'} />
          <Info label="Notes" value={customer.notes || '—'} />
        </div>
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Historique de réservations</h3>
          {reservations.length === 0 ? <div style={{ color: '#64748b' }}>Aucune réservation.</div> : reservations.sort((a, b) => new Date(String(b.startDateTime || 0)).getTime() - new Date(String(a.startDateTime || 0)).getTime()).map((r) => (
            <div key={r._id || r.reservationNumber} style={{ borderTop: '1px solid #e5e7eb', padding: '10px 0', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div><strong>{r.reservationNumber || 'Réservation'}</strong><div style={{ color: '#64748b', marginTop: 3 }}>{dateTime(r.startDateTime)} → {dateTime(r.endDateTime)}</div></div>
              <div style={{ textAlign: 'right' }}><strong>{money(r.totalCents, r.currency || 'CAD')}</strong><div style={{ color: '#64748b', marginTop: 3 }}>{r.status || '—'}</div></div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div><button style={danger} onClick={onDelete}>Supprimer</button></div>
        <div style={{ display: 'flex', gap: 10 }}><button style={secondary} onClick={onToggle}>{customer.active === false ? 'Réactiver' : 'Désactiver'}</button><button style={primary} onClick={onEdit}>Modifier</button></div>
      </div>
    </div>
  </div>;
};

const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => <label style={{ display: 'block' }}><span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</span>{children}</label>;
const Info: FC<{ label: string; value: string }> = ({ label, value }) => <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 12, padding: '7px 0' }}><strong>{label}</strong><span>{value}</span></div>;
const Stat: FC<{ label: string; value: string }> = ({ label, value }) => <div style={{ ...card, padding: 14 }}><div style={{ color: '#64748b', fontSize: 13 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{value}</div></div>;

export default CustomersPage;
