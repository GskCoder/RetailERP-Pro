import { useState, useEffect } from 'react';
import Header from '../components/Header';
import DataTable from '../components/DataTable';
import SupplierForm from './SupplierForm';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Suppliers() {
  const { isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/suppliers', { params: { limit: 100, search: searchTerm } });
      setSuppliers(res.data.suppliers || []);
    } catch (error) {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadSuppliers();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const handleAdd = () => {
    setEditingSupplier(null);
    setIsFormOpen(true);
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setIsFormOpen(true);
  };

  const handleDelete = async (supplier) => {
    if (window.confirm(`Are you sure you want to delete supplier "${supplier.supplier_name}"?`)) {
      try {
        await api.delete(`/suppliers/${supplier.id}`);
        toast.success('Supplier deleted successfully');
        loadSuppliers();
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Failed to delete supplier');
      }
    }
  };

  const columns = [
    { key: 'supplier_name', label: 'Supplier Name', accessor: 'supplier_name' },
    { key: 'contact_person', label: 'Contact Person', accessor: 'contact_person' },
    { key: 'phone_number', label: 'Phone', accessor: 'phone_number' },
    { key: 'gstin', label: 'GSTIN', accessor: 'gstin' },
    { key: 'state', label: 'State', accessor: 'state' },
    {
      key: 'actions',
      label: 'Actions',
      accessor: 'actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
            title="Edit Supplier"
          >
            <Edit2 size={14} />
          </button>
          {isAdmin && (
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
              title="Delete Supplier"
              style={{ color: 'var(--color-danger)' }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <>
      <Header title="Suppliers" />
      <div style={{ padding: 28, flex: 1, overflowY: 'auto' }}>

        {/* Top Action Bar matching Customers.jsx */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search suppliers by name, phone, or GSTIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input"
            style={{ maxWidth: 320 }}
          />
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={handleAdd} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} />
            Add Supplier
          </button>
        </div>

        {/* Table Container matching Customers.jsx */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <DataTable
            columns={columns}
            data={suppliers}
            loading={loading}
            emptyMessage="No suppliers found."
          />
        </div>
      </div>

      {isFormOpen && (
        <SupplierForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          supplier={editingSupplier}
          onSaved={loadSuppliers}
        />
      )}
    </>
  );
}
