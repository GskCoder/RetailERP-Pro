import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function SupplierForm({ isOpen, onClose, supplier, onSaved }) {
  const [formData, setFormData] = useState({
    supplier_name: '',
    contact_person: '',
    phone_number: '',
    email: '',
    address: '',
    gstin: '',
    state: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (supplier) {
      setFormData({
        supplier_name: supplier.supplier_name || '',
        contact_person: supplier.contact_person || '',
        phone_number: supplier.phone_number || '',
        email: supplier.email || '',
        address: supplier.address || '',
        gstin: supplier.gstin || '',
        state: supplier.state || ''
      });
    } else {
      setFormData({
        supplier_name: '',
        contact_person: '',
        phone_number: '',
        email: '',
        address: '',
        gstin: '',
        state: ''
      });
    }
  }, [supplier]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplier_name || !formData.phone_number) {
      toast.error('Supplier name and phone number are required');
      return;
    }

    setLoading(true);
    try {
      if (supplier) {
        await api.put(`/suppliers/${supplier.id}`, formData);
        toast.success('Supplier updated successfully');
      } else {
        await api.post('/suppliers', formData);
        toast.success('Supplier added successfully');
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save supplier');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={supplier ? "Edit Supplier" : "Add Supplier"}
      size="md"
      footer={
        <>
          {/* Updated button classes to match system styling */}
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      {/* Updated to use CSS Grid layout mirroring the Customers component */}
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Supplier Name *</label>
          <input
            type="text"
            name="supplier_name"
            value={formData.supplier_name}
            onChange={handleChange}
            className="form-input"
            placeholder="e.g. Acme Corp"
            required
          />
        </div>
        
        <div className="form-group">
          <label className="form-label">Contact Person</label>
          <input
            type="text"
            name="contact_person"
            value={formData.contact_person}
            onChange={handleChange}
            className="form-input"
            placeholder="Name of contact"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Phone Number *</label>
          <input
            type="text"
            name="phone_number"
            value={formData.phone_number}
            onChange={handleChange}
            className="form-input"
            placeholder="10-digit number"
            required
          />
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="form-input"
            placeholder="supplier@example.com"
          />
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Address</label>
          <textarea
            name="address"
            value={formData.address}
            onChange={handleChange}
            className="form-input"
            style={{ minHeight: '80px' }}
            placeholder="Full address"
          />
        </div>

        <div className="form-group">
          <label className="form-label">GSTIN</label>
          <input
            type="text"
            name="gstin"
            value={formData.gstin}
            onChange={handleChange}
            className="form-input uppercase"
            placeholder="e.g. 27AAAAA0000A1Z5"
          />
        </div>

        <div className="form-group">
          <label className="form-label">State</label>
          <input
            type="text"
            name="state"
            value={formData.state}
            onChange={handleChange}
            className="form-input"
            placeholder="e.g. Maharashtra"
          />
        </div>
      </form>
    </Modal>
  );
}