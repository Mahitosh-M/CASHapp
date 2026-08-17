import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MonthlyHistorySections } from '../components/MonthlyHistorySections';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { getCashHistoryMonth, getCashPreviousHistoryDates } from '../services/cashService';

export const HistoryPage = () => {
  const { currentShopId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const loadMonth = useCallback((start: Date, end: Date) => {
    if (!currentShopId) return Promise.resolve([]);
    return getCashHistoryMonth(currentShopId, start, end);
  }, [currentShopId]);

  const loadPreviousDates = useCallback((before: Date) => {
    if (!currentShopId) return Promise.resolve([]);
    return getCashPreviousHistoryDates(currentShopId, before);
  }, [currentShopId]);

  const editTransfer = useCallback((transferId: string) => {
    navigate(`/transfer/${transferId}/edit`, {
      state: { returnTo: location.pathname }
    });
  }, [location.pathname, navigate]);

  return (
    <div className="page history-page">
      <PageHeader title="History" subtitle="Cash activity by month" />
      <MonthlyHistorySections
        queryKey={currentShopId || 'none'}
        emptyText="No cash activity found."
        loadMonth={loadMonth}
        loadPreviousDates={loadPreviousDates}
        onEditTransfer={editTransfer}
      />
    </div>
  );
};
