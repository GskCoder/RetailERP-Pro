import { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/formatters';

export default function AddPaymentModal({ isOpen, onClose, customer, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [desc, setDesc] = useState('Account Payment');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setMethod('cash');
      setDesc('Account Payment');
    }
  }, [isOpen]);

  async function handleSave(e) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/customers/${customer.id}/payments`, {
        amount: Number(amount),
        payment_method: method,
        description: desc
      });
      toast.success('Payment recorded');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to record payment');
    }
    setSaving(false);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Record Payment: ${customer?.customer_name || ''}`} size="sm"
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Payment'}</button></>}
    >
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
          Current Balance (Due): <strong style={{ color: 'var(--color-text-primary)' }}>{formatCurrency(customer?.current_balance || 0)}</strong>
        </p>
      </div>
      <form onSubmit={handleSave} style={{ display: 'grid', gap: 16 }}>
        <div className="form-group">
          <label className="form-label">Amount</label>
          <input className="form-input" type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label">Payment Method</label>
          <select className="form-input" value={method} onChange={e => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <input className="form-input" value={desc} onChange={e => setDesc(e.target.value)} required />
        </div>
      </form>
    </Modal>
  );
}
