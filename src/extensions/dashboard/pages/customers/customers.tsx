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
};

type Reservation = {
  customerId?: string;
  customerEmail?: string;
  totalCents?: number;
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
  firstName: '',
  lastName: '',
  companyName: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  region: 'QC',
  postalCode: '',
  country: 'Canada',
  discountPercent: '0',
  notes: '',
};

const card: CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,.06)',
};

const primary: CSSProperties = {
  border: 0,
  borderRadius: 8,
  padding: '10px 16px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  background: '#116dff',
  color: '#fff',
};

const secondary: CSSProperties = {
  ...primary,
  border: '1px solid #116dff',
  background: '#fff',
  color: '#116dff',
};

const input: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 14,
  background: '#fff',
};

function customerNumber(): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const random = Math.floor(1000 + Math.random() * 9000);
  return `C-${stamp}-${random}`;
}

function fullName(customer: Customer): string {
  const person = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  return person || customer.companyName || 'Client sans nom';
}

function money(cents = 0): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
}

const CustomersPage: FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<CustomerForm>(blankForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [customerResult, reservationResult] = await Promise.all([
        items.query(CUSTOMERS).limit(1000).find(),
        items.query(RESERVATIONS).limit(1000).find(),
      ]);
      setCustomers(customerResult.items as Customer[]);
      setReservations(reservationResult.items as Reservation[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les clients.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter((customer) => showInactive || customer.active !== false)
      .filter((customer) => {
        if (!q) return true;
        return [
          customer.customerNumber,
          customer.firstName,
          customer.lastName,
          customer.companyName,
          customer.email,
          customer.phone,
        ].some((value) => value?.toLowerCase().includes(q));
      })
      .sort((a, b) => fullName(a).localeCompare(fullName(b), 'fr'));
  }, [customers, search, showInactive]);

  const stats = useMemo(() => {
    const active = customers.filter((customer) => customer.active !== false).length;
    const revenue = reservations
      .filter((reservation) => reservation.status !== 'CANCELLED' && reservation.status !== 'ERROR')
      .reduce((sum, reservation) => sum + (reservation.totalCents || 0), 0);
    return { active, reservations: reservations.length, revenue };
  }, [customers, reservations]);

  const customerStats = (customer: Customer) => {
    const email = customer.email?.trim().toLowerCase();
    const linked = reservations.filter((reservation) =>
      (customer._id && reservation.customerId === customer._id) ||
      (!!email && reservation.customerEmail?.trim().toLowerCase() === email)
    );
    return {
      count: linked.length,
      revenue: linked
        .filter((reservation) => reservation.status !== 'CANCELLED' && reservation.status !== 'ERROR')
        .reduce((sum, reservation) => sum + (reservation.totalCents || 0), 0),
    };
  };

  const add = () => {
    setEditing(null);
    setForm(blankForm);
    setFormError('');
    setOpen(true);
  };

  const edit = (customer: Customer) => {
    setEditing(customer);
    setForm({
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      companyName: customer.companyName || '',
      email: customer.email || '',
      phone: customer.phone || '',
      addressLine1: customer.addressLine1 || '',
      addressLine2: customer.addressLine2 || '',
      city: customer.city || '',
      region: customer.region || '',
      postalCode: customer.postalCode || '',
      country: customer.country || 'Canada',
      discountPercent: String(customer.discountPercent || 0),
      notes: customer.notes || '',
    });
    setFormError('');
    setOpen(true);
  };

  const close = () => {
    if (!saving) {
      setOpen(false);
      setEditing(null);
      setFormError('');
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setSuccess('');

    if (!form.firstName.trim() && !form.lastName.trim() && !form.companyName.trim()) {
      return setFormError('Entrez un nom de personne ou un nom d’entreprise.');
    }

    const email = form.email.trim().toLowerCase();
    if (email) {
      const duplicate = customers.some((customer) =>
        customer._id !== editing?._id && customer.email?.trim().toLowerCase() === email
      );
      if (duplicate) return setFormError('Un client avec ce courriel existe déjà.');
    }

    const discountPercent = Number(form.discountPercent.replace(',', '.'));
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return setFormError('Le rabais client doit être entre 0 et 100 %.');
    }

    setSaving(true);
    try {
      const data: Customer = {
        customerNumber: editing?.customerNumber || customerNumber(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        companyName: form.companyName.trim(),
        email,
        phone: form.phone.trim(),
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim(),
        city: form.city.trim(),
        region: form.region.trim(),
        postalCode: form.postalCode.trim().toUpperCase(),
        country: form.country.trim(),
        discountPercent,
        notes: form.notes.trim(),
        active: editing?.active !== false,
      };

      if (editing?._id) {
        await items.update(CUSTOMERS, { _id: editing._id, ...data });
        setSuccess(`${fullName(data)} a été modifié.`);
      } else {
        await items.insert(CUSTOMERS, data);
        setSuccess(`${fullName(data)} a été ajouté.`);
      }

      setOpen(false);
      setEditing(null);
      setForm(blankForm);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Impossible d’enregistrer le client.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (customer: Customer) => {
    if (!customer._id) return;
    const next = customer.active === false;
    if (!next && !window.confirm(`Désactiver ${fullName(customer)} ? Son historique sera conservé.`)) return;
    setError('');
    setSuccess('');
    try {
      await items.update(CUSTOMERS, { ...customer, active: next });
      setSuccess(next ? `${fullName(customer)} a été réactivé.` : `${fullName(customer)} a été désactivé.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de modifier le statut du client.');
    }
  };

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header title="Clients" subtitle="Centralisez les coordonnées, rabais et historique de location de vos clients." />
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
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Afficher les inactifs
                </label>
              </div>

              {loading ? <div>Chargement…</div> : filtered.length === 0 ? (
                <div style={{ padding: 36, textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 10 }}>Aucun client à afficher.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                    <thead><tr style={{ textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: 10 }}>Client</th><th>No client</th><th>Coordonnées</th><th>Réservations</th><th>Revenus</th><th>Rabais</th><th style={{ textAlign: 'right' }}>Actions</th>
                    </tr></thead>
                    <tbody>{filtered.map((customer) => {
                      const summary = customerStats(customer);
                      return <tr key={customer._id || customer.customerNumber} style={{ borderTop: '1px solid #e5e7eb', opacity: customer.active === false ? .6 : 1 }}>
                        <td style={{ padding: 12 }}><strong>{fullName(customer)}</strong>{customer.companyName && (customer.firstName || customer.lastName) ? <div style={{ color: '#64748b', marginTop: 3 }}>{customer.companyName}</div> : null}</td>
                        <td>{customer.customerNumber || '—'}</td>
                        <td><div>{customer.email || '—'}</div><div style={{ color: '#64748b', marginTop: 3 }}>{customer.phone || ''}</div></td>
                        <td>{summary.count}</td>
                        <td>{money(summary.revenue)}</td>
                        <td>{customer.discountPercent || 0} %</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><button style={{ ...secondary, padding: '7px 11px', marginRight: 7 }} onClick={() => edit(customer)}>Modifier</button><button style={{ ...secondary, padding: '7px 11px', borderColor: customer.active === false ? '#16a34a' : '#dc2626', color: customer.active === false ? '#15803d' : '#b91c1c' }} onClick={() => void toggleActive(customer)}>{customer.active === false ? 'Réactiver' : 'Désactiver'}</button></td>
                      </tr>;
                    })}</tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Page.Content>
      </Page>

      {open && (
        <div onMouseDown={close} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
          <div onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 900, maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 14 }}>
            <form onSubmit={save}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
                <div><h2 style={{ margin: 0 }}>{editing ? 'Modifier le client' : 'Nouveau client'}</h2><div style={{ color: '#64748b', marginTop: 4 }}>{editing?.customerNumber || 'Le numéro client sera généré automatiquement.'}</div></div>
                <button type="button" onClick={close} disabled={saving} style={{ border: 0, background: 'transparent', fontSize: 26 }}>×</button>
              </div>

              <div style={{ padding: 24 }}>
                {formError && <div style={{ background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: 12, marginBottom: 18 }}>{formError}</div>}
                <h3 style={{ marginTop: 0 }}>Identité</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
                  <Field label="Prénom"><input style={input} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
                  <Field label="Nom"><input style={input} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
                  <Field label="Entreprise"><input style={input} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></Field>
                  <Field label="Courriel"><input type="email" style={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                  <Field label="Téléphone"><input style={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                  <Field label="Rabais client (%)"><input type="number" min="0" max="100" step="0.5" style={input} value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} /></Field>
                </div>

                <h3 style={{ marginTop: 24 }}>Adresse</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
                  <Field label="Adresse"><input style={input} value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} /></Field>
                  <Field label="Appartement / unité"><input style={input} value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} /></Field>
                  <Field label="Ville"><input style={input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
                  <Field label="Province / État"><input style={input} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></Field>
                  <Field label="Code postal"><input style={input} value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></Field>
                  <Field label="Pays"><input style={input} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
                </div>

                <div style={{ marginTop: 20 }}><Field label="Notes"><textarea style={{ ...input, minHeight: 100 }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
              </div>

              <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" style={secondary} onClick={close} disabled={saving}>Annuler</button>
                <button type="submit" style={primary} disabled={saving}>{saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer le client'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </WixDesignSystemProvider>
  );
};

const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => <label style={{ display: 'block' }}><span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</span>{children}</label>;
const Stat: FC<{ label: string; value: string }> = ({ label, value }) => <div style={{ ...card, padding: 14 }}><div style={{ color: '#64748b', fontSize: 13 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{value}</div></div>;

export default CustomersPage;
