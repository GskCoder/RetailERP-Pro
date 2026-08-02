import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import StatsCard from '../components/StatsCard';
import { formatCurrency } from '../utils/formatters';
import api from '../api/axios';
import { IndianRupee, ShoppingCart, Package, AlertTriangle, TrendingUp, CreditCard } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({ today_count: 0, today_revenue: 0, today_profit: 0 });
  const [products, setProducts] = useState({ total: 0 });
  const [lowStock, setLowStock] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [creditPending, setCreditPending] = useState([]);
  const navigate = useNavigate();

  async function loadDashboard() {
    try {
      const [statsRes, productsRes, lowStockRes, salesRes, creditRes] = await Promise.all([
        api.get('/sales/today-summary'),
        api.get('/products', { params: { limit: 1 } }),
        api.get('/products/low-stock'),
        api.get('/sales', { params: { limit: 10 } }),
        api.get('/sales/credit-pending'),
      ]);
      setStats(statsRes.data);
      setProducts(productsRes.data);
      setLowStock(lowStockRes.data);
      setRecentSales(salesRes.data.sales || []);
      setCreditPending(creditRes.data);
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadDashboard(); }, []);

  return (
    <>
      <Header title="Dashboard" />
      <div style={{ padding: 28, flex: 1, overflowY: 'auto' }}>
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 28 }}>
          <StatsCard icon={ShoppingCart} label="Today's Sales" value={stats.today_count} suffix=" orders" color="var(--color-primary)" delay={0} />
          <StatsCard icon={IndianRupee} label="Today's Revenue" value={stats.today_revenue} prefix="₹" color="var(--color-success)" delay={100} />
          <StatsCard icon={TrendingUp} label="Today's Profit" value={stats.today_profit} prefix="₹" color="var(--card-emerald)" delay={200} />
          <StatsCard icon={Package} label="Total Products" value={products.total || 0} color="var(--color-info)" delay={300} />
          <StatsCard icon={AlertTriangle} label="Low Stock Items" value={lowStock.length} color="var(--color-warning)" delay={400} />
          <StatsCard icon={CreditCard} label="Credit Pending" value={creditPending.length} suffix=" sales" color="var(--color-danger)" delay={500} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Recent Sales */}
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>Recent Sales</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/sales')}>View All</button>
            </div>
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {recentSales.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>No sales yet</div>
              ) : (
                recentSales.map(sale => (
                  <div
                    key={sale.id}
                    onClick={() => navigate(`/sales`)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 20px', borderBottom: '1px solid var(--color-border-light)',
                      cursor: 'pointer', transition: 'var(--transition)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{sale.invoice_number}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{sale.customer_name || 'Walk-in'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-success)' }}>{formatCurrency(sale.total_amount)}</div>
                      <span className={`badge badge-${sale.status === 'completed' ? 'success' : sale.status === 'returned' ? 'warning' : 'danger'}`} style={{ fontSize: 11 }}>
                        {sale.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Low Stock & Credit */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Low Stock */}
            <div className="glass-card" style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 15, fontWeight: 600 }}>
                  <AlertTriangle size={16} style={{ color: 'var(--color-warning)', marginRight: 8, verticalAlign: 'middle' }} />
                  Low Stock Alerts
                </h3>
              </div>
              <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                {lowStock.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>All stock levels healthy ✓</div>
                ) : (
                  lowStock.slice(0, 5).map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--color-border-light)' }}>
                      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{p.product_name}</span>
                      <span className={`badge ${p.stock_quantity <= 0 ? 'badge-danger' : 'badge-warning'}`}>
                        {p.stock_quantity <= 0 ? 'Out of stock' : `${p.stock_quantity} left`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Credit Pending */}
            <div className="glass-card" style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 15, fontWeight: 600 }}>
                  <CreditCard size={16} style={{ color: 'var(--color-danger)', marginRight: 8, verticalAlign: 'middle' }} />
                  Credit Due
                </h3>
              </div>
              <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                {creditPending.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>No pending credits ✓</div>
                ) : (
                  creditPending.slice(0, 5).map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--color-border-light)' }}>
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{s.customer_name || s.invoice_number}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{s.invoice_number}</div>
                      </div>
                      <span className="badge badge-danger">{formatCurrency(s.amount_due)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
