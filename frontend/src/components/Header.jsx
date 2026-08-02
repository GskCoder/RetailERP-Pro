import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { LogOut, User, ChevronDown, Plus, Search, Command } from 'lucide-react';

export default function Header({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const triggerSearch = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
  };

  return (
    <header style={{
      height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 28px', borderBottom: '1px solid var(--color-border)',
      background: 'var(--color-surface)',
    }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Search trigger */}
        <button
          onClick={triggerSearch}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '7px 14px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            cursor: 'pointer', transition: 'var(--transition)',
            color: 'var(--color-text-muted)', fontSize: 13,
            minWidth: 200,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--color-text-muted)';
            e.currentTarget.style.background = 'var(--color-surface-hover)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.background = 'var(--color-surface)';
          }}
        >
          <Search size={14} />
          <span style={{ flex: 1, textAlign: 'left' }}>Search...</span>
          <kbd style={{
            padding: '1px 6px', borderRadius: 4,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            fontSize: 11, color: 'var(--color-text-muted)',
          }}>
            Ctrl+K
          </kbd>
        </button>

        {/* Quick Sale button */}
        <button
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/sales/new')}
          style={{ gap: 6 }}
        >
          <Plus size={16} /> New Sale
        </button>

        {/* User dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'transparent',
              cursor: 'pointer', transition: 'var(--transition)',
              color: 'var(--color-text-primary)',
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 600, color: 'white',
            }}>
              {user?.username?.[0]?.toUpperCase() || 'A'}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.username}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{user?.role}</div>
            </div>
            <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
          </button>

          {dropdownOpen && (
            <div
              className="animate-scale-in"
              style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 8,
                width: 200, background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)', zIndex: 200, overflow: 'hidden',
              }}
            >
              <button
                onClick={() => { setDropdownOpen(false); navigate('/settings'); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', border: 'none', background: 'transparent',
                  color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 13,
                  transition: 'var(--transition)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <User size={16} /> Profile
              </button>
              <div style={{ height: 1, background: 'var(--color-border)' }} />
              <button
                onClick={() => { setDropdownOpen(false); logout(); navigate('/login'); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', border: 'none', background: 'transparent',
                  color: 'var(--color-danger)', cursor: 'pointer', fontSize: 13,
                  transition: 'var(--transition)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-danger-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
