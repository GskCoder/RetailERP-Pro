import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatters';
import { Plus, Edit, Trash2, Book, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import AddPaymentModal from '../components/AddPaymentModal';

const emptyCustomer = { customer_name: '', phone_number: '', email: '', address: '', gstin: '', state: '' };

export default function Customers() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyCustomer);
  const [saving, setSaving] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [activeCustomer, setActiveCustomer] = useState(null);

  async function loadCustomers() {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (search) params.search = search;
      const res = await api.get('/customers', { params });
      setCustomers(res.data.customers || []);
    } catch { toast.error('Failed to load customers'); }
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadCustomers(); }, [search]);

  function openAdd() { setEditing(null); setForm(emptyCustomer); setModalOpen(true); }
  function openEdit(c) { setEditing(c); setForm({ ...c }); setModalOpen(true); }
  function openLedger(c) { navigate(`/customers/${c.id}/ledger`); }
  function openPayment(c) { setActiveCustomer(c); setPaymentOpen(true); }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.customer_name) { toast.error('Customer name is required'); return; }
    setSaving(true);
    try {
      const data = { ...form, phone_number: form.phone_number || null, gstin: form.gstin || null };
      if (editing) { await api.put(`/customers/${editing.id}`, data); toast.success('Customer updated'); }
      else { await api.post('/customers', data); toast.success('Customer added'); }
      setModalOpen(false); loadCustomers();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setSaving(false);
  }

  async function handleDelete(c) {
    if (!confirm(`Delete "${c.customer_name}"?`)) return;
    try { await api.delete(`/customers/${c.id}`); toast.success('Deleted'); loadCustomers(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  }

  const columns = [
    { key: 'customer_name', label: 'Name', accessor: 'customer_name' },
    { key: 'phone_number', label: 'Phone', render: r => r.phone_number || '-' },
    { key: 'email', label: 'Email', render: r => r.email || '-' },
    { key: 'state', label: 'State', render: r => r.state || '-' },
    { key: 'gstin', label: 'GSTIN', render: r => r.gstin || '-' },
    { key: 'total_purchases', label: 'Total Purchases', render: r => formatCurrency(r.total_purchases) },
    { key: 'current_balance', label: 'Balance Due', render: r => formatCurrency(r.current_balance) },
  ];

  return (
    <>
      <Header title="Customers" />
      <div style={{ padding: 28, flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
          <input className="form-input" placeholder="Search by name, phone, email..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320 }} />
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Customer</button>
        </div>

        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <DataTable columns={columns} data={customers} loading={loading} searchable={false}
            actions={row => (
              <>
                <button className="btn btn-ghost btn-icon btn-sm" title="View Ledger" onClick={e => { e.stopPropagation(); openLedger(row); }}><Book size={14} /></button>
                <button className="btn btn-ghost btn-icon btn-sm" title="Add Payment" onClick={e => { e.stopPropagation(); openPayment(row); }}><DollarSign size={14} /></button>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={e => { e.stopPropagation(); openEdit(row); }}><Edit size={14} /></button>
                {isAdmin && <button className="btn btn-ghost btn-icon btn-sm" onClick={e => { e.stopPropagation(); handleDelete(row); }} style={{ color: 'var(--color-danger)' }}><Trash2 size={14} /></button>}
              </>
            )}
          />
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Customer' : 'Add Customer'} size="md"
        footer={<><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></>}
      >
        <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Customer Name *</label>
            <input className="form-input" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} required />
          </div>
          <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone_number || ''} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">State</label><input className="form-input" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="e.g. Maharashtra" /></div>
          <div className="form-group"><label className="form-label">GSTIN</label><input className="form-input" value={form.gstin || ''} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} /></div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Address</label><textarea className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2} /></div>
        </form>
      </Modal>

      <AddPaymentModal isOpen={paymentOpen} onClose={() => setPaymentOpen(false)} customer={activeCustomer} onSuccess={loadCustomers} />
    </>
  );
}
