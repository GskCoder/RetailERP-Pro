import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Package, Users, ShoppingCart, FileText,
  Settings, Shield, ChevronLeft, ChevronRight, Store, BarChart3, LineChart, Wallet
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/products', label: 'Products', icon: Package },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/suppliers', label: 'Suppliers', icon: Store },
  { path: '/purchases', label: 'Purchases', icon: Package },
  { path: '/sales', label: 'Sales', icon: ShoppingCart },
  { path: '/invoices', label: 'Invoices', icon: FileText },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/analytics', label: 'Analytics', icon: LineChart },
  { path: '/expenses', label: 'Expenses', icon: Wallet },
  { divider: true },
  { path: '/audit-logs', label: 'Audit Logs', icon: Shield, adminOnly: true },
  { path: '/staff', label: 'Staff', icon: Users, adminOnly: true },
  { path: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { isAdmin } = useAuth();
  const location = useLocation();

  const filteredItems = navItems.filter(item =>
    !item.adminOnly || isAdmin
  );

  return (
    <aside
      style={{
        width: collapsed ? 72 : 260,
        height: '100vh',
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 100,
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div style={{
        padding: collapsed ? '20px 16px' : '20px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid var(--color-border)',
        minHeight: 72,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
        }}>
          <Store size={20} color="white" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>
              RetailERP
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Lite</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {filteredItems.map((item, i) => {
          if (item.divider) {
            return <div key={i} style={{ height: 1, background: 'var(--color-border)', margin: '8px 6px' }} />;
          }

          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: collapsed ? '12px 0' : '10px 14px',
                borderRadius: 'var(--radius-md)',
                marginBottom: 2,
                textDecoration: 'none',
                justifyContent: collapsed ? 'center' : 'flex-start',
                transition: 'var(--transition)',
                background: isActive ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                color: isActive ? 'var(--color-primary-light)' : 'var(--color-text-secondary)',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = 'var(--color-surface-hover)';
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <Icon size={20} style={{ flexShrink: 0 }} />
              {!collapsed && (
                <span style={{ fontSize: 14, fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap' }}>
                  {item.label}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div style={{
        padding: '12px 10px', borderTop: '1px solid var(--color-border)',
        display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end',
      }}>
        <button
          className="btn-ghost btn-icon"
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </aside>
  );
}
