import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Customers from './pages/Customers';
import CustomerLedger from './pages/CustomerLedger';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import NewPurchase from './pages/NewPurchase';
import Reports from './pages/Reports';
import Analytics from './pages/Analytics';
import Expenses from './pages/Expenses';
import NewSale from './pages/NewSale';
import Sales from './pages/Sales';
import Invoices from './pages/Invoices';
import InvoiceView from './pages/InvoiceView';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import StaffManagement from './pages/StaffManagement';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              boxShadow: 'var(--shadow-lg)',
            },
            success: { iconTheme: { primary: 'var(--color-success)', secondary: '#FFFFFF' } },
            error: { iconTheme: { primary: 'var(--color-danger)', secondary: '#FFFFFF' } },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Protected routes with sidebar layout */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:customerId/ledger" element={<CustomerLedger />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/purchases/new" element={<NewPurchase />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/sales/new" element={<NewSale />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/:saleId" element={<InvoiceView />} />

            {/* Admin-only routes */}
            <Route path="/audit-logs" element={<ProtectedRoute requiredRole="admin"><AuditLogs /></ProtectedRoute>} />
            <Route path="/staff" element={<ProtectedRoute requiredRole="admin"><StaffManagement /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requiredRole="admin"><Settings /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
