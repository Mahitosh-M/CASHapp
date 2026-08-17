import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { LoadingScreen } from './components/LoadingScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CashProvider } from './context/CashContext';
import { ExpensePage } from './pages/ExpensePage';
import { AdminPage } from './pages/AdminPage';
import { CategoryHistoryPage } from './pages/CategoryHistoryPage';
import { EditTransferPage } from './pages/EditTransferPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
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
          <Route path="transfer" element={<TransferPage />} />
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
