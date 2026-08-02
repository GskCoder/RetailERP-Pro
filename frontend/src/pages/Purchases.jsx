import { useState, useEffect } from 'react';
import Header from '../components/Header';
import DataTable from '../components/DataTable';
import api from '../api/axios';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Purchases() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadPurchases = async () => {
    setLoading(true);
    try {
      const res = await api.get('/purchases', { params: { limit: 100 } });
      setPurchases(res.data.purchases || []);
    } catch (error) {
      toast.error('Failed to load purchases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchases();
  }, []);
  
  const columns = [
    { key: 'supplier_invoice_number', label: 'Invoice No.', accessor: 'supplier_invoice_number' },
    { key: 'purchase_date', label: 'Date', render: (row) => formatDateTime(row.purchase_date) },
    { key: 'supplier_name', label: 'Supplier', accessor: 'supplier_name' },
    { key: 'total_amount', label: 'Total Amount', render: (row) => formatCurrency(row.total_amount) },
    {
      key: 'payment_status',
      label: 'Payment Status',
      render: (row) => (
        <span className={`badge ${row.payment_status === 'paid' ? 'badge-success' :
          row.payment_status === 'partial' ? 'badge-warning' : 'badge-danger'
          }`}>
          {row.payment_status.toUpperCase()}
        </span>
      )
    }
  ];

  return (
    <>
      <Header title="Purchases" />
      <div style={{ padding: 28, flex: 1, overflowY: 'auto' }}>

        {/* Top Action Bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Purchase History
          </h2>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/purchases/new')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} />
            Record New Purchase
          </button>
        </div>

        {/* Table Container */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <DataTable
            columns={columns}
            data={purchases}
            loading={loading}
            emptyMessage="No purchases recorded yet."
          />
        </div>
      </div>
    </>
  );
}