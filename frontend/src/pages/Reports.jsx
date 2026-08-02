import { useState, useEffect } from 'react';
import Header from '../components/Header';
import StatsCard from '../components/StatsCard';
import api from '../api/axios';
import { formatCurrency } from '../utils/formatters';
import {
  BarChart3, FileSpreadsheet, FileText, Download, Calendar,
  TrendingUp, IndianRupee, Package, Users, Receipt,
  ArrowUpRight, ArrowDownRight, Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';

const REPORT_TYPES = [
  { id: 'sales', label: 'Sales Report', icon: TrendingUp, color: 'var(--color-success)' },
  { id: 'inventory', label: 'Inventory Report', icon: Package, color: 'var(--color-info)' },
  { id: 'gst', label: 'GST Report', icon: Receipt, color: 'var(--color-primary)' },
  { id: 'customers', label: 'Customer Report', icon: Users, color: 'var(--color-warning)' },
  { id: 'profit_loss', label: 'Profit & Loss', icon: BarChart3, color: 'var(--card-violet)' },
];

const STOCK_FILTERS = [
  { value: 'all', label: 'All Products' },
  { value: 'low', label: 'Low Stock Only' },
  { value: 'out', label: 'Out of Stock Only' },
];

function getDefaultDates() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    start: start.toISOString().split('T')[0],
    end: today.toISOString().split('T')[0],
  };
}

export default function Reports() {
  const [activeReport, setActiveReport] = useState('sales');
  const [dates, setDates] = useState(getDefaultDates());
  const [stockFilter, setStockFilter] = useState('all');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = {};
      if (activeReport !== 'customers' && activeReport !== 'inventory') {
        params.start = dates.start;
        params.end = dates.end;
      }
      if (activeReport === 'inventory') {
        params.stock_filter = stockFilter;
      }
      const res = await api.get(`/reports/${activeReport.replace('_', '-')}`, { params });
      setReportData(res.data);
    } catch (err) {
      toast.error('Failed to load report');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReport, stockFilter]);

  const handleExport = async (format) => {
    try {
      const params = {};
      if (activeReport !== 'customers' && activeReport !== 'inventory') {
        params.start = dates.start;
        params.end = dates.end;
      }
      if (activeReport === 'inventory') {
        params.stock_filter = stockFilter;
      }

      const res = await api.get(`/reports/export/${format}/${activeReport}`, {
        params,
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      link.download = `${activeReport}_report_${new Date().toISOString().split('T')[0]}.${ext}`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} downloaded!`);
    } catch {
      toast.error(`Failed to export ${format.toUpperCase()}`);
    }
  };

  const needsDateFilter = activeReport !== 'customers' && activeReport !== 'inventory';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header title="Reports" />

      <div style={{ padding: 28, flex: 1, overflowY: 'auto' }}>
        {/* Report Type Selector */}
        <div style={{
          display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap',
        }}>
          {REPORT_TYPES.map(rt => {
            const Icon = rt.icon;
            const isActive = activeReport === rt.id;
            return (
              <button
                key={rt.id}
                onClick={() => { setActiveReport(rt.id); setReportData(null); }}
                className="animate-fade-in"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 20px',
                  borderRadius: 'var(--radius-lg)',
                  border: `1px solid ${isActive ? rt.color : 'var(--color-border)'}`,
                  background: isActive
                    ? `linear-gradient(135deg, ${rt.color}15, ${rt.color}08)`
                    : 'var(--color-surface)',
                  color: isActive ? rt.color : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  boxShadow: isActive ? `0 0 20px ${rt.color}20` : 'none',
                }}
              >
                <Icon size={18} />
                {rt.label}
              </button>
            );
          })}
        </div>

        {/* Filters Bar */}
        <div className="glass-card" style={{
          display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
          marginBottom: 20, flexWrap: 'wrap',
        }}>
          {needsDateFilter && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={16} style={{ color: 'var(--color-text-muted)' }} />
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 500 }}>From</span>
                <input
                  type="date"
                  value={dates.start}
                  onChange={e => setDates({ ...dates, start: e.target.value })}
                  className="form-input"
                  style={{ width: 160, padding: '6px 10px', fontSize: 13 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 500 }}>To</span>
                <input
                  type="date"
                  value={dates.end}
                  onChange={e => setDates({ ...dates, end: e.target.value })}
                  className="form-input"
                  style={{ width: 160, padding: '6px 10px', fontSize: 13 }}
                />
              </div>
            </>
          )}

          {activeReport === 'inventory' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={16} style={{ color: 'var(--color-text-muted)' }} />
              <select
                className="form-select"
                value={stockFilter}
                onChange={e => setStockFilter(e.target.value)}
                style={{ width: 180, padding: '6px 10px', fontSize: 13 }}
              >
                {STOCK_FILTERS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          )}

          <button className="btn btn-primary btn-sm" onClick={loadReport} disabled={loading}>
            {loading ? 'Loading...' : 'Generate Report'}
          </button>

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleExport('excel')}
              style={{ gap: 6 }}
              disabled={!reportData || loading}
            >
              <FileSpreadsheet size={15} />
              Excel
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleExport('pdf')}
              style={{ gap: 6 }}
              disabled={!reportData || loading}
            >
              <FileText size={15} />
              PDF
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 60, borderRadius: 'var(--radius-lg)' }} />
            ))}
          </div>
        )}

        {/* Report Content */}
        {!loading && reportData && (
          <div className="animate-fade-in">
            {/* Summary Cards */}
            <ReportSummary data={reportData} activeReport={activeReport} />

            {/* Data Table */}
            <div className="glass-card" style={{ marginTop: 20, overflow: 'hidden' }}>
              <div style={{
                padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <h3 style={{ fontSize: 15, fontWeight: 600 }}>
                  Details ({reportData.rows?.length || 0} records)
                </h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <ReportTable rows={reportData.rows || []} reportType={activeReport} />
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !reportData && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '80px 20px', color: 'var(--color-text-muted)',
          }}>
            <BarChart3 size={64} style={{ opacity: 0.15, marginBottom: 16 }} />
            <p style={{ fontSize: 15 }}>Select a report type and click Generate</p>
          </div>
        )}
      </div>
    </div>
  );
}


/* ------- Summary Cards Component ------- */
function ReportSummary({ data, activeReport }) {
  const summary = data?.summary || {};

  const configs = {
    sales: [
      { icon: TrendingUp, label: 'Total Sales', value: summary.total_sales, color: 'var(--color-primary)' },
      { icon: IndianRupee, label: 'Revenue', value: summary.total_revenue, prefix: '₹', color: 'var(--color-success)' },
      { icon: ArrowUpRight, label: 'Profit', value: summary.total_profit, prefix: '₹', color: 'var(--card-emerald)' },
      { icon: Receipt, label: 'Total Tax', value: summary.total_tax, prefix: '₹', color: 'var(--color-warning)' },
    ],
    inventory: [
      { icon: Package, label: 'Total Products', value: summary.total_products, color: 'var(--color-info)' },
      { icon: IndianRupee, label: 'Stock Value (Cost)', value: summary.total_stock_value, prefix: '₹', color: 'var(--color-warning)' },
      { icon: IndianRupee, label: 'Retail Value', value: summary.total_retail_value, prefix: '₹', color: 'var(--color-success)' },
      { icon: ArrowUpRight, label: 'Potential Profit', value: summary.potential_profit, prefix: '₹', color: 'var(--card-emerald)' },
    ],
    gst: [
      { icon: IndianRupee, label: 'Taxable Value', value: summary.total_taxable_value, prefix: '₹', color: 'var(--color-info)' },
      { icon: Receipt, label: 'CGST', value: summary.total_cgst, prefix: '₹', color: 'var(--color-primary)' },
      { icon: Receipt, label: 'SGST', value: summary.total_sgst, prefix: '₹', color: 'var(--color-primary-light)' },
      { icon: Receipt, label: 'Total Tax', value: summary.total_tax, prefix: '₹', color: 'var(--color-success)' },
    ],
    customers: [
      { icon: Users, label: 'Total Customers', value: summary.total_customers, color: 'var(--color-info)' },
      { icon: IndianRupee, label: 'Total Purchases', value: summary.total_purchases, prefix: '₹', color: 'var(--color-success)' },
      { icon: ArrowDownRight, label: 'Credit Due', value: summary.total_credit_due, prefix: '₹', color: 'var(--color-danger)' },
    ],
    profit_loss: [
      { icon: IndianRupee, label: 'Revenue', value: summary.total_revenue, prefix: '₹', color: 'var(--color-success)' },
      { icon: Package, label: 'COGS', value: summary.total_cogs, prefix: '₹', color: 'var(--color-warning)' },
      { icon: ArrowUpRight, label: 'Gross Profit', value: summary.gross_profit, prefix: '₹', color: 'var(--card-emerald)' },
      { icon: TrendingUp, label: 'Net Profit', value: summary.net_profit, prefix: '₹', color: 'var(--color-primary)' },
    ],
  };

  const cards = configs[activeReport] || [];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`,
      gap: 16,
    }}>
      {cards.map((card, i) => (
        <StatsCard
          key={i}
          icon={card.icon}
          label={card.label}
          value={card.value || 0}
          prefix={card.prefix}
          color={card.color}
          delay={i * 80}
        />
      ))}
    </div>
  );
}


/* ------- Report Table Component ------- */
function ReportTable({ rows, reportType }) {
  if (!rows || rows.length === 0) {
    return (
      <div style={{
        padding: '60px 20px', textAlign: 'center',
        color: 'var(--color-text-muted)', fontSize: 14,
      }}>
        No data found for the selected period
      </div>
    );
  }

  const headers = Object.keys(rows[0]);

  const formatValue = (key, value) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number' && (
      key.includes('price') || key.includes('value') || key.includes('total') ||
      key.includes('amount') || key.includes('profit') || key.includes('revenue') ||
      key.includes('cgst') || key.includes('sgst') || key.includes('igst') ||
      key.includes('discount') || key.includes('tax') || key.includes('purchases') ||
      key.includes('credit') || key.includes('cogs') || key.includes('cost')
    )) {
      return formatCurrency(value);
    }
    return String(value);
  };

  const getStatusBadge = (value) => {
    if (value === 'low') return <span className="badge badge-warning">LOW</span>;
    if (value === 'out_of_stock') return <span className="badge badge-danger">OUT</span>;
    if (value === 'normal') return <span className="badge badge-success">OK</span>;
    return value;
  };

  return (
    <table className="data-table">
      <thead>
        <tr>
          {headers.map(h => (
            <th key={h}>{h.replace(/_/g, ' ')}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="animate-fade-in" style={{ animationDelay: `${i * 20}ms` }}>
            {headers.map(h => (
              <td key={h} style={{
                textAlign: typeof row[h] === 'number' ? 'right' : 'left',
                fontWeight: h.includes('total') || h.includes('profit') || h.includes('net') ? 600 : 400,
                color: h === 'amount' && row[h] < 0 ? 'var(--color-danger)' : undefined,
              }}>
                {h === 'status' ? getStatusBadge(row[h]) : formatValue(h, row[h])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
