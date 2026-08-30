import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { LoadingScreen } from './components/LoadingScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CashProvider } from './context/CashContext';
import { ExpensePage } from './pages/ExpensePage';
import { AdminPage } from './pages/AdminPage';
import { CategoryHistoryPage } from './pages/CategoryHistoryPage';
import { EditTransferPage } from './pages/EditTransferPage';
import { EditExpensePage } from './pages/EditExpensePage';
import { EmiPage } from './pages/EmiPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { PurchasePage } from './pages/PurchasePage';
import { TransferPage } from './pages/TransferPage';

const AppRoutes = () => {
  const { firebaseUser, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!firebaseUser || !profile) return <LoginPage />;

  return (
    <CashProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="expense" element={<ExpensePage />} />
          <Route path="expense/:expenseId/edit" element={profile.role === 'Admin' ? <EditExpensePage /> : <Navigate to="/history/expenses" replace />} />
          <Route path="transfer" element={<TransferPage />} />
          <Route path="purchase" element={<PurchasePage />} />
          <Route path="emi" element={<EmiPage />} />
          <Route path="transfer/:transferId/edit" element={<EditTransferPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="history/:category" element={<CategoryHistoryPage />} />
          <Route path="admin" element={profile.role === 'Admin' ? <AdminPage /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </CashProvider>
  );
};

export const App = () => (
  <AuthProvider>
    <AppRoutes />
  </AuthProvider>
);
