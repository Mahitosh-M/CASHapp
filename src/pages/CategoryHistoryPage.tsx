import { useCallback } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { MonthlyHistorySections } from '../components/MonthlyHistorySections';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import {
  getCashCategoryHistoryMonth,
  getCashCategoryPreviousHistoryDates
} from '../services/cashService';
import type { CashHistoryCategory } from '../types';
import { getShopName } from '../utils/shops';

const categoryDetails: Record<CashHistoryCategory, { title: string; empty: string }> = {
  collections: { title: 'Collections', empty: 'No payment collections found.' },
  expenses: { title: 'Expenses', empty: 'No expenses found.' },
  'transfers-in': { title: 'Transferred in', empty: 'No incoming transfers found.' },
  'transfers-out': { title: 'Transferred out', empty: 'No outgoing transfers found.' }
};

const isCashHistoryCategory = (value: string | undefined): value is CashHistoryCategory => (
  Boolean(value && value in categoryDetails)
);

export const CategoryHistoryPage = () => {
  const { category: categoryParam } = useParams<{ category: string }>();
  const { currentShopId, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const category = isCashHistoryCategory(categoryParam) ? categoryParam : null;

  const loadMonth = useCallback((start: Date, end: Date) => {
    if (!category || !currentShopId) return Promise.resolve([]);
    return getCashCategoryHistoryMonth(currentShopId, category, start, end);
  }, [category, currentShopId]);

  const loadPreviousDates = useCallback((before: Date) => {
    if (!category || !currentShopId) return Promise.resolve([]);
    return getCashCategoryPreviousHistoryDates(currentShopId, category, before);
  }, [category, currentShopId]);

  const editTransfer = useCallback((transferId: string) => {
    navigate(`/transfer/${transferId}/edit`, {
      state: { returnTo: location.pathname }
    });
  }, [location.pathname, navigate]);

  const editExpense = useCallback((expenseId: string) => {
    navigate(`/expense/${expenseId}/edit`, { state: { returnTo: location.pathname } });
  }, [location.pathname, navigate]);

  if (!category) return <Navigate to="/" replace />;
  const details = categoryDetails[category];

  return (
    <div className="page history-page">
      <PageHeader
        title={details.title}
        subtitle={`Entries for ${currentShopId ? getShopName(currentShopId) : 'this shop'}`}
        backTo="/"
      />
      <MonthlyHistorySections
        queryKey={`${currentShopId || 'none'}:${category}`}
        emptyText={details.empty}
        loadMonth={loadMonth}
        loadPreviousDates={loadPreviousDates}
        onEditTransfer={editTransfer}
        onEditExpense={profile?.role === 'Admin' ? editExpense : undefined}
      />
    </div>
  );
};
