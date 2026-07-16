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
      
      {/* Added standard padding wrapper for the page content */}
      <div style={{ padding: 28, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-6">
          
          {/* Left Side: Product Search & Catalog */}
          <div className="flex-1 flex flex-col gap-4 min-w-[300px]">
            {/* Updated 'card' to 'glass-card' and added padding */}
            <div className="glass-card h-full flex flex-col p-5">
              <div className="mb-4 relative">
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search products to add..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {products
                  .filter(p => p.product_name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search))
                  .slice(0, 20)
                  .map(product => (
                    <div 
                      key={product.id}
                      className="p-3 rounded-xl border border-slate-700/50 bg-slate-800/30 hover:bg-slate-700/50 cursor-pointer transition-colors flex justify-between items-center"
                      onClick={() => addToCart(product)}
                    >
                      <div className="truncate pr-2">
                        <div className="font-medium text-sm truncate" title={product.product_name}>{product.product_name}</div>
                        <div className="text-xs text-slate-400 mt-1">Stock: {product.stock_quantity}</div>
                      </div>
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                          <Plus size={16} />
                        </div>
                      </div>
                    </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Side: Cart & Details */}
          <div className="w-full lg:w-[450px] flex flex-col gap-4">
            {/* Updated 'card' to 'glass-card' and added padding */}
            <div className="glass-card flex-1 flex flex-col overflow-hidden p-5">
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div className="form-group mb-0">
                  <label className="form-label">Supplier *</label>
                  <select 
                    className="form-input"
                    value={supplierId}
                    onChange={e => setSupplierId(e.target.value)}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
                  </select>
                </div>
                <div className="form-group mb-0">
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

              <div className="flex-1 overflow-y-auto border-t border-b border-slate-700/50 py-4 mb-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                    <ShoppingBag size={48} className="opacity-20" />
                    <p>No items added yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.product_id} className="bg-slate-800/30 p-3 rounded-lg border border-slate-700/30">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium text-sm truncate pr-2">{item.product_name}</div>
                          <button 
                            className="text-rose-400/70 hover:text-rose-400"
                            onClick={() => removeFromCart(item.product_id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-slate-400 block mb-1">Qty</label>
                            <input 
                              type="number" 
                              min="1" 
                              className="form-input text-center" 
                              value={item.quantity}
                              onChange={(e) => updateCartItem(item.product_id, 'quantity', parseInt(e.target.value) || 1)}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-slate-400 block mb-1">Unit Cost</label>
                            <input 
                              type="number" 
                              min="0" 
                              className="form-input" 
                              value={item.unit_price}
                              onChange={(e) => updateCartItem(item.product_id, 'unit_price', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div className="flex-1 text-right">
                            <label className="text-xs text-slate-400 block mb-1">Total</label>
                            <div className="font-medium mt-1 pr-1">{formatCurrency(item.total)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 text-sm">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center gap-4 text-slate-300">
                  <span>Discount</span>
                  <input 
                    type="number" 
                    className="form-input w-24 text-right" 
                    value={discount}
                    onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="flex justify-between items-center gap-4 text-slate-300">
                  <span>Tax Amount</span>
                  <input 
                    type="number" 
                    className="form-input w-24 text-right" 
                    value={taxAmount}
                    onChange={e => setTaxAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="border-t border-slate-700/50 pt-3 flex justify-between items-center font-bold text-lg text-white">
                  <span>Total Amount</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-2 gap-4">
                <select 
                  className="form-input"
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

              {/* Updated button class to match UI spec */}
              <button 
                className="btn btn-primary w-full mt-4 flex items-center justify-center gap-2 py-3"
                onClick={handleSubmit}
                disabled={saving || cart.length === 0}
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