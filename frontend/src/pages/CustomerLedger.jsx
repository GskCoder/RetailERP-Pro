import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import api from '../api/axios';
import { formatCurrency, formatDate } from '../utils/formatters';
import { ArrowLeft, Download, FileText, FileSpreadsheet, Calendar, Filter, TrendingUp, TrendingDown, Wallet, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

const PRESETS = [
  { label: 'This Month', key: 'this_month' },
  { label: 'Last Month', key: 'last_month' },
  { label: 'Last 3 Months', key: 'last_3' },
  { label: 'Last 6 Months', key: 'last_6' },
  { label: 'This Year', key: 'this_year' },
  { label: 'All Time', key: 'all' },
];

function getPresetDates(key) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed

  const fmt = (d) => d.toISOString().split('T')[0];
  const firstOfMonth = (yr, mo) => new Date(yr, mo, 1);
  const lastOfMonth = (yr, mo) => new Date(yr, mo + 1, 0);

  switch (key) {
    case 'this_month':
      return { date_from: fmt(firstOfMonth(y, m)), date_to: fmt(lastOfMonth(y, m)) };
    case 'last_month': {
      const pm = m === 0 ? 11 : m - 1;
      const py = m === 0 ? y - 1 : y;
      return { date_from: fmt(firstOfMonth(py, pm)), date_to: fmt(lastOfMonth(py, pm)) };
    }
    case 'last_3': {
      const start = new Date(y, m - 2, 1);
      return { date_from: fmt(start), date_to: fmt(lastOfMonth(y, m)) };
    }
    case 'last_6': {
      const start = new Date(y, m - 5, 1);
      return { date_from: fmt(start), date_to: fmt(lastOfMonth(y, m)) };
    }
    case 'this_year':
      return { date_from: `${y}-01-01`, date_to: `${y}-12-31` };
    case 'all':
    default:
      return { date_from: '', date_to: '' };
  }
}

const TYPE_BADGE_MAP = {
  sale: { className: 'badge badge-danger', label: 'Sale' },
  payment: { className: 'badge badge-success', label: 'Payment' },
  refund: { className: 'badge badge-warning', label: 'Refund' },
  opening_balance: { className: 'badge badge-info', label: 'Opening' },
};

export default function CustomerLedger() {
  const { customerId } = useParams();
  const navigate = useNavigate();

  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePreset, setActivePreset] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  async function loadLedger(dateFrom = '', dateTo = '') {
    setLoading(true);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await api.get(`/customers/${customerId}/ledger`, { params });
      setLedger(res.data);
    } catch {
      toast.error('Failed to load ledger');
    }
    setLoading(false);
  }

  useEffect(() => {
    loadLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  function handlePreset(key) {
    setActivePreset(key);
    const { date_from, date_to } = getPresetDates(key);
    setCustomFrom(date_from);
    setCustomTo(date_to);
    setAppliedFrom(date_from);
    setAppliedTo(date_to);
    loadLedger(date_from, date_to);
  }

  function handleCustomApply() {
    setActivePreset('custom');
    setAppliedFrom(customFrom);
    setAppliedTo(customTo);
    loadLedger(customFrom, customTo);
  }

  function buildDownloadParams() {
    const params = new URLSearchParams();
    if (appliedFrom) params.set('date_from', appliedFrom);
    if (appliedTo) params.set('date_to', appliedTo);
    return params.toString();
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      const queryStr = buildDownloadParams();
      const res = await api.get(`/customers/${customerId}/ledger/download/pdf${queryStr ? '?' + queryStr : ''}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const disposition = res.headers['content-disposition'];
      const filename = disposition ? disposition.split('filename=')[1]?.replace(/"/g, '') : 'ledger.pdf';
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to download PDF');
    }
    setDownloadingPdf(false);
  }

  async function handleDownloadCsv() {
    setDownloadingCsv(true);
    try {
      const queryStr = buildDownloadParams();
      const res = await api.get(`/customers/${customerId}/ledger/download/csv${queryStr ? '?' + queryStr : ''}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      const disposition = res.headers['content-disposition'];
      const filename = disposition ? disposition.split('filename=')[1]?.replace(/"/g, '') : 'ledger.csv';
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch {
      toast.error('Failed to download CSV');
    }
    setDownloadingCsv(false);
  }

  const entries = ledger?.entries || [];

  const summaryCards = useMemo(() => {
    if (!ledger) return [];
    return [
      { label: 'Opening Balance', value: ledger.opening_balance, icon: Wallet, color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
      { label: 'Total Debit (Dr)', value: ledger.total_debit, icon: TrendingUp, color: 'var(--color-danger)', bg: 'var(--color-danger-bg)' },
      { label: 'Total Credit (Cr)', value: ledger.total_credit, icon: TrendingDown, color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
      { label: 'Closing Balance', value: ledger.closing_balance, icon: DollarSign, color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
    ];
  }, [ledger]);

  // Date range display
  const dateRangeLabel = appliedFrom && appliedTo
    ? `${formatDate(appliedFrom)} — ${formatDate(appliedTo)}`
    : appliedFrom
      ? `From ${formatDate(appliedFrom)}`
      : appliedTo
        ? `Up to ${formatDate(appliedTo)}`
        : 'All Time';

  return (
    <>
      <Header title={`Ledger: ${ledger?.customer_name || 'Customer'}`} />
      <div style={{ padding: 28, flex: 1, overflowY: 'auto' }}>

        {/* Top Bar: Back + Customer Info + Downloads */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => navigate('/customers')} style={{ gap: 6 }}>
            <ArrowLeft size={16} /> Back to Customers
          </button>
          <div style={{ flex: 1 }} />
          <button
            id="download-pdf-btn"
            className="btn btn-primary"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            style={{ gap: 6 }}
          >
            <FileText size={16} /> {downloadingPdf ? 'Generating...' : 'Download PDF'}
          </button>
          <button
            id="download-csv-btn"
            className="btn btn-secondary"
            onClick={handleDownloadCsv}
            disabled={downloadingCsv}
            style={{ gap: 6 }}
          >
            <FileSpreadsheet size={16} /> {downloadingCsv ? 'Generating...' : 'Download CSV'}
          </button>
        </div>

        {/* Customer Info Card */}
        {ledger && (
          <div className="glass-card animate-fade-in" style={{ padding: 20, marginBottom: 24, display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700, color: '#fff',
              }}>
                {ledger.customer_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>{ledger.customer_name}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {ledger.customer_phone || 'No phone'} {ledger.customer_gstin ? `· GSTIN: ${ledger.customer_gstin}` : ''}
                </div>
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Balance Due
              </div>
              <div style={{
                fontSize: 24, fontWeight: 800,
                color: ledger.closing_balance > 0 ? 'var(--color-danger)' : 'var(--color-success)',
              }}>
                {formatCurrency(ledger.closing_balance)}
              </div>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="glass-card animate-fade-in" style={{ padding: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--color-text-secondary)', fontSize: 13, fontWeight: 600 }}>
            <Filter size={14} /> Date Filter
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 400 }}>
              Showing: {dateRangeLabel}
            </span>
          </div>

          {/* Preset Buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {PRESETS.map(p => (
              <button
                key={p.key}
                id={`filter-preset-${p.key}`}
                className={`btn btn-sm ${activePreset === p.key ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handlePreset(p.key)}
                style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20 }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ minWidth: 160 }}>
              <label className="form-label" style={{ fontSize: 11 }}>From Date</label>
              <input
                id="filter-date-from"
                className="form-input"
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                style={{ fontSize: 13, padding: '8px 12px' }}
              />
            </div>
            <div className="form-group" style={{ minWidth: 160 }}>
              <label className="form-label" style={{ fontSize: 11 }}>To Date</label>
              <input
                id="filter-date-to"
                className="form-input"
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                style={{ fontSize: 13, padding: '8px 12px' }}
              />
            </div>
            <button
              id="filter-apply-btn"
              className="btn btn-primary btn-sm"
              onClick={handleCustomApply}
              style={{ height: 38, gap: 6 }}
            >
              <Calendar size={14} /> Apply
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        {ledger && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            {summaryCards.map((card, idx) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="glass-card animate-slide-up"
                  style={{ padding: 20, animationDelay: `${idx * 80}ms` }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 'var(--radius-md)',
                      background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={18} color={card.color} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                      {card.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-primary)' }}>
                    {formatCurrency(card.value)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ledger Table */}
        <div className="glass-card animate-fade-in" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} color="var(--color-primary-light)" />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>Transaction Ledger</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-muted)' }}>
              {entries.length} entries
            </span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 20 }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 44, width: '100%' }} />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-muted)' }}>
              <Wallet size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: 15, fontWeight: 500 }}>No transactions found</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Try adjusting the date filters above.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>#</th>
                    <th style={{ width: 120 }}>Date</th>
                    <th style={{ width: 90 }}>Type</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right', width: 130 }}>Debit (Dr)</th>
                    <th style={{ textAlign: 'right', width: 130 }}>Credit (Cr)</th>
                    <th style={{ textAlign: 'right', width: 140 }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Opening balance row */}
                  {ledger?.opening_balance !== undefined && (
                    <tr style={{ background: 'rgba(59, 130, 246, 0.05)' }}>
                      <td></td>
                      <td style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>—</td>
                      <td><span className="badge badge-info">Opening</span></td>
                      <td style={{ fontWeight: 500 }}>Opening Balance (Brought Forward)</td>
                      <td style={{ textAlign: 'right' }}>—</td>
                      <td style={{ textAlign: 'right' }}>—</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {formatCurrency(ledger.opening_balance)}
                      </td>
                    </tr>
                  )}
                  {entries.map((entry, idx) => {
                    const typeBadge = TYPE_BADGE_MAP[entry.transaction_type] || { className: 'badge badge-neutral', label: entry.transaction_type };
                    return (
                      <tr key={entry.id} className="animate-fade-in" style={{ animationDelay: `${idx * 20}ms` }}>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{idx + 1}</td>
                        <td>{formatDate(entry.transaction_date)}</td>
                        <td><span className={typeBadge.className}>{typeBadge.label}</span></td>
                        <td style={{ color: 'var(--color-text-primary)' }}>{entry.description}</td>
                        <td style={{
                          textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                          color: entry.debit > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)',
                        }}>
                          {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                        </td>
                        <td style={{
                          textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                          color: entry.credit > 0 ? 'var(--color-success)' : 'var(--color-text-muted)',
                        }}>
                          {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                        </td>
                        <td style={{
                          textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                          color: 'var(--color-text-primary)',
                        }}>
                          {formatCurrency(entry.balance_after)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Totals row */}
                  {ledger && entries.length > 0 && (
                    <tr style={{
                      background: 'rgba(79, 70, 229, 0.08)',
                      borderTop: '2px solid var(--color-primary)',
                    }}>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td style={{ fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.04em' }}>
                        Totals
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--color-danger)', fontSize: 15 }}>
                        {formatCurrency(ledger.total_debit)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--color-success)', fontSize: 15 }}>
                        {formatCurrency(ledger.total_credit)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--color-text-primary)', fontSize: 15 }}>
                        {formatCurrency(ledger.closing_balance)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
