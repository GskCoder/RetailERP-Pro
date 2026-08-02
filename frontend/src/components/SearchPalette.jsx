import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Users, ShoppingCart, Store, Command, ArrowRight, X } from 'lucide-react';
import api from '../api/axios';

const categoryIcons = {
  products: Package,
  customers: Users,
  sales: ShoppingCart,
  suppliers: Store,
};

const categoryColors = {
  products: 'var(--color-info)',
  customers: 'var(--color-success)',
  sales: 'var(--color-warning)',
  suppliers: 'var(--color-primary-light)',
};

const categoryLabels = {
  products: 'Products',
  customers: 'Customers',
  sales: 'Sales',
  suppliers: 'Suppliers',
};

export default function SearchPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const debounceRef = useRef(null);

  // Flatten results for keyboard navigation
  const flatResults = results
    ? Object.entries(results).flatMap(([category, items]) =>
        items.map(item => ({ ...item, category }))
      )
    : [];

  // Open/close with Ctrl+K
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults(null);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Debounced search
  const doSearch = useCallback(async (q) => {
    if (q.length < 1) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/search?q=${encodeURIComponent(q)}`);
      setResults(res.data.results);
      setSelectedIndex(0);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(query.trim()), 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  // Navigate to selected result
  const handleSelect = (item) => {
    setIsOpen(false);
    navigate(item.url);
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && flatResults[selectedIndex]) {
      e.preventDefault();
      handleSelect(flatResults[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  const hasResults = flatResults.length > 0;
  const totalResults = flatResults.length;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
      }}
      onClick={() => setIsOpen(false)}
    >
      {/* Backdrop */}
      <div
        className="animate-fade-in"
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(6px),',
        }}
      />

      {/* Search Modal */}
      <div
        className="animate-scale-in"
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%', maxWidth: 620,
          margin: '0 20px',
          background: '#FFFFFF',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Search Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border-light)',
        }}>
          <Search size={20} style={{ color: 'var(--color-primary-light)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search products, customers, sales, suppliers..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--color-text-primary)',
              fontSize: 16,
              fontFamily: 'inherit',
            }}
            autoComplete="off"
            spellCheck="false"
          />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {query && (
              <button
                onClick={() => { setQuery(''); setResults(null); inputRef.current?.focus(); }}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--color-text-muted)', padding: 4,
                }}
              >
                <X size={16} />
              </button>
            )}
            <kbd style={{
              padding: '2px 8px', borderRadius: 4,
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)', fontSize: 11,
              fontFamily: 'inherit',
            }}>
              ESC
            </kbd>
          </div>
        </div>

        {/* Results */}
        <div style={{
          maxHeight: 400, overflowY: 'auto',
          padding: (loading || hasResults || query) ? '8px' : 0,
        }}>
          {/* Loading state */}
          {loading && (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <div className="skeleton" style={{ height: 40, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 40, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 40 }} />
            </div>
          )}

          {/* Results */}
          {!loading && hasResults && (
            <>
              {Object.entries(results).map(([category, items]) => {
                if (items.length === 0) return null;
                const Icon = categoryIcons[category];
                const color = categoryColors[category];
                const label = categoryLabels[category];

                return (
                  <div key={category} style={{ marginBottom: 4 }}>
                    <div style={{
                      padding: '8px 12px',
                      fontSize: 11, fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: color,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <Icon size={12} />
                      {label}
                      <span style={{
                        fontSize: 10, color: 'var(--color-text-muted)',
                        fontWeight: 400, textTransform: 'none',
                        letterSpacing: 0,
                      }}>
                        ({items.length})
                      </span>
                    </div>

                    {items.map((item) => {
                      const globalIdx = flatResults.findIndex(
                        r => r.id === item.id && r.category === category
                      );
                      const isSelected = globalIdx === selectedIndex;

                      return (
                        <button
                          key={`${category}-${item.id}`}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          style={{
                            width: '100%',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: 12,
                            padding: '10px 16px',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            background: isSelected
                              ? 'rgba(99, 102, 241, 0.08)'
                              : 'transparent',
                            color: 'var(--color-text-primary)',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease',
                            textAlign: 'left',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>
                              {item.title}
                            </div>
                            {item.subtitle && (
                              <div style={{
                                fontSize: 12, color: 'var(--color-text-muted)',
                                marginTop: 2,
                              }}>
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                          {isSelected && (
                            <ArrowRight size={14} style={{ color: 'var(--color-primary-light)', flexShrink: 0 }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          {/* Empty state */}
          {!loading && query && !hasResults && results !== null && (
            <div style={{
              padding: '32px 20px', textAlign: 'center',
              color: 'var(--color-text-muted)', fontSize: 14,
            }}>
              <Search size={28} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <div>No results for "<strong style={{ color: 'var(--color-text-secondary)' }}>{query}</strong>"</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Try a different search term</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          borderTop: '1px solid var(--color-border-light)',
          fontSize: 11, color: 'var(--color-text-muted)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <kbd style={{
                padding: '1px 5px', borderRadius: 3,
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                fontSize: 10,
              }}>↑↓</kbd>
              navigate
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <kbd style={{
                padding: '1px 5px', borderRadius: 3,
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                fontSize: 10,
              }}>↵</kbd>
              select
            </span>
          </div>
          {hasResults && (
            <span>{totalResults} result{totalResults !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  );
}
