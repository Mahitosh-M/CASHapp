import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCashCategoryHistoryMonth, getCashCategoryPreviousHistoryDates } from '../services/cashService';
import type { CashHistoryCategory } from '../types';
import { MonthlyHistorySections } from './MonthlyHistorySections';

export const CashCategoryHistory = ({ category, emptyText }: { category: CashHistoryCategory; emptyText: string }) => {
  const { currentShopId, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const loadMonth = useCallback((start: Date, end: Date) => currentShopId
    ? getCashCategoryHistoryMonth(currentShopId, category, start, end) : Promise.resolve([]), [category, currentShopId]);
  const loadPreviousDates = useCallback((before: Date) => currentShopId
    ? getCashCategoryPreviousHistoryDates(currentShopId, category, before) : Promise.resolve([]), [category, currentShopId]);
  const returnTo = location.pathname + location.search;
  return <>
    {category === 'fuel' && <p className="notice">Dispatch diesel appears after shop-funded approval or personal reimbursement. Do not enter it a second time.</p>}
    <MonthlyHistorySections
      queryKey={`${currentShopId || 'none'}:${category}`}
      emptyText={emptyText}
      loadMonth={loadMonth}
      loadPreviousDates={loadPreviousDates}
      onEditTransfer={id => navigate(`/transfer/${id}/edit`, { state: { returnTo } })}
      onEditExpense={profile?.role === 'Admin' ? id => navigate(`/expense/${id}/edit`, { state: { returnTo } }) : undefined}
    />
  </>;
};
