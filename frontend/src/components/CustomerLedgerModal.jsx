import { useState, useEffect } from 'react';
import Modal from './Modal';
import DataTable from './DataTable';
import api from '../api/axios';
import { formatCurrency, formatDate } from '../utils/formatters';
import toast from 'react-hot-toast';

export default function CustomerLedgerModal({ isOpen, onClose, customer }) {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && customer) {
      loadLedger();
    }
  }, [isOpen, customer]);

  async function loadLedger() {
    setLoading(true);
    try {
      const res = await api.get(`/customers/${customer.id}/ledger`);
      setLedger(res.data);
    } catch {
      toast.error('Failed to load ledger');
    }
    setLoading(false);
  }

  const columns = [
    { key: 'date', label: 'Date', render: r => formatDate(r.transaction_date) },
    { key: 'desc', label: 'Description', render: r => r.description },
    { key: 'debit', label: 'Debit (Dr)', render: r => r.debit > 0 ? formatCurrency(r.debit) : '-' },
    { key: 'credit', label: 'Credit (Cr)', render: r => r.credit > 0 ? formatCurrency(r.credit) : '-' },
    { key: 'balance', label: 'Balance', render: r => formatCurrency(r.balance_after) },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Ledger: ${customer?.customer_name || ''}`} size="lg"
      footer={<button className="btn btn-secondary" onClick={onClose}>Close</button>}
    >
      <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        <DataTable columns={columns} data={ledger} loading={loading} searchable={false} />
      </div>
    </Modal>
  );
}
