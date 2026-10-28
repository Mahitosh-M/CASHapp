import { Navigate, useParams } from 'react-router-dom';
import { CashCategoryHistory } from '../components/CashCategoryHistory';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import type { CashHistoryCategory } from '../types';
import { getShopName } from '../utils/shops';

const categoryDetails: Record<CashHistoryCategory, { title: string; empty: string }> = {
  collections: { title: 'Collections', empty: 'No payment collections found.' },
  expenses: { title: 'Expenses', empty: 'No expenses found.' },
  fuel: { title: 'Fuel', empty: 'No paid fuel expenses found.' },
  'transfers-in': { title: 'Transferred in', empty: 'No incoming transfers found.' },
  'transfers-out': { title: 'Transferred out', empty: 'No outgoing transfers found.' }
};

const isCashHistoryCategory = (value: string | undefined): value is CashHistoryCategory => (
  Boolean(value && value in categoryDetails)
);

export const CategoryHistoryPage = () => {
  const { category: categoryParam } = useParams<{ category: string }>();
  const { currentShopId } = useAuth();
  const category = isCashHistoryCategory(categoryParam) ? categoryParam : null;

  if (!category) return <Navigate to="/" replace />;
  const details = categoryDetails[category];

  return (
    <div className="page history-page">
      <PageHeader
        title={details.title}
        subtitle={`Entries for ${currentShopId ? getShopName(currentShopId) : 'this shop'}`}
        backTo="/"
      />
      <CashCategoryHistory category={category} emptyText={details.empty} />
    </div>
  );
};
