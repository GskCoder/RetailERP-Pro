import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import api from '../api/axios';
import { Search, Plus, Trash2, Save, ShoppingBag } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import toast from 'react-hot-toast';

export default function NewPurchase() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [cart, setCart] = useState([]);
  
  const [discount, setDiscount] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [amountPaid, setAmountPaid] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/suppliers', { params: { limit: 100 } }).then(res => setSuppliers(res.data.suppliers || []));
    api.get('/products', { params: { limit: 100 } }).then(res => setProducts(res.data.products || []));
  }, []);

  const addToCart = (product) => {
    const existing = cart.find(item => item.product_id === product.id);
    if (existing) {
      setCart(cart.map(item => item.product_id === product.id 
        ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unit_price } 
        : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        product_name: product.product_name,
        quantity: 1,
        unit_price: product.purchase_price || 0,
        total: product.purchase_price || 0
      }]);
    }
    setSearch('');
  };

  const updateCartItem = (productId, field, value) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        const updated = { ...item, [field]: value };
        updated.total = updated.quantity * updated.unit_price;
        return updated;
      }
      return item;
    }));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const totalAmount = subtotal - discount + taxAmount;

  const handleSubmit = async () => {
    if (!supplierId || !invoiceNumber) {
      toast.error('Supplier and Invoice Number are required');
      return;
    }
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        supplier_invoice_number: invoiceNumber,
        supplier_id: parseInt(supplierId),
        subtotal,
        discount_amount: discount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_status: paymentStatus,
        amount_paid: paymentStatus === 'paid' ? totalAmount : amountPaid,
        items: cart
      };
      
      await api.post('/purchases', payload);
      toast.success('Purchase recorded successfully');
      navigate('/purchases');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to record purchase');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header title="Record Purchase (Stock Intake)" />
      
      <div style={{ padding: 28, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: 24 }}>
          
          {/* Left Side: Product Search & Catalog */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 300 }}>
            <div className="glass-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 20 }}>
              <div style={{ marginBottom: 16, position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search products to add..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: 42 }}
                />
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, alignContent: 'start' }}>
                {products
                  .filter(p => p.product_name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search))
                  .slice(0, 20)
                  .map(product => (
                    <div 
                      key={product.id}
                      onClick={() => addToCart(product)}
                      style={{
                        padding: 12, borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        cursor: 'pointer', transition: 'var(--transition)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                        e.currentTarget.style.background = 'var(--color-primary-subtle)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                        e.currentTarget.style.background = 'var(--color-surface)';
                      }}
                    >
                      <div style={{ overflow: 'hidden', paddingRight: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={product.product_name}>{product.product_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>Stock: {product.stock_quantity}</div>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: 'var(--color-primary-subtle)', color: 'var(--color-primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Plus size={16} />
                        </div>
                      </div>
                    </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Side: Cart & Details */}
          <div style={{ width: 450, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 20 }}>
              <div style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Supplier *</label>
                  <select 
                    className="form-select"
                    value={supplierId}
                    onChange={e => setSupplierId(e.target.value)}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Invoice Number *</label>
                  <input 
                    type="text" 
                    className="form-input"
                    placeholder="e.g. INV-1029"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', padding: '16px 0', marginBottom: 16 }}>
                {cart.length === 0 ? (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', gap: 12 }}>
                    <ShoppingBag size={48} style={{ opacity: 0.2 }} />
                    <p>No items added yet</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {cart.map(item => (
                      <div key={item.product_id} style={{
                        background: 'var(--color-surface-hover)', padding: 12,
                        borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{item.product_name}</div>
                          <button 
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => removeFromCart(item.product_id)}
                            style={{ color: 'var(--color-danger)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Qty</label>
                            <input 
                              type="number" 
                              min="1" 
                              className="form-input" 
                              value={item.quantity}
                              onChange={(e) => updateCartItem(item.product_id, 'quantity', parseInt(e.target.value) || 1)}
                              style={{ textAlign: 'center', padding: '6px 10px', fontSize: 13 }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Unit Cost</label>
                            <input 
                              type="number" 
                              min="0" 
                              className="form-input" 
                              value={item.unit_price}
                              onChange={(e) => updateCartItem(item.product_id, 'unit_price', parseFloat(e.target.value) || 0)}
                              style={{ padding: '6px 10px', fontSize: 13 }}
                            />
                          </div>
                          <div style={{ flex: 1, textAlign: 'right' }}>
                            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Total</label>
                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)', paddingRight: 4, marginTop: 6 }}>{formatCurrency(item.total)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-secondary)' }}>
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, color: 'var(--color-text-secondary)' }}>
                  <span>Discount</span>
                  <input 
                    type="number" 
                    className="form-input" 
                    style={{ width: 96, textAlign: 'right', padding: '6px 10px', fontSize: 13 }} 
                    value={discount}
                    onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, color: 'var(--color-text-secondary)' }}>
                  <span>Tax Amount</span>
                  <input 
                    type="number" 
                    className="form-input" 
                    style={{ width: 96, textAlign: 'right', padding: '6px 10px', fontSize: 13 }} 
                    value={taxAmount}
                    onChange={e => setTaxAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, fontSize: 18, color: 'var(--color-text-primary)' }}>
                  <span>Total Amount</span>
                  <span className="text-gradient">{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <select 
                  className="form-select"
                  value={paymentStatus}
                  onChange={e => setPaymentStatus(e.target.value)}
                >
                  <option value="paid">Paid Full</option>
                  <option value="partial">Partial Payment</option>
                  <option value="unpaid">Unpaid</option>
                </select>
                
                {paymentStatus === 'partial' && (
                  <input 
                    type="number"
                    placeholder="Amount Paid"
                    className="form-input"
                    value={amountPaid}
                    onChange={e => setAmountPaid(parseFloat(e.target.value) || 0)}
                  />
                )}
              </div>

              <button 
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={saving || cart.length === 0}
                style={{ width: '100%', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, fontSize: 15, fontWeight: 700 }}
              >
                <Save size={18} />
                {saving ? 'Recording...' : 'Record Purchase'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}