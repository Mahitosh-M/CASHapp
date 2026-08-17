import { History } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { CashHistoryList } from '../components/CashHistoryList';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import {
  getCashCategoryHistoryPage,
  getFriendlyCashError,
  type CashHistoryCursor
} from '../services/cashService';
import type { CashHistoryCategory, CashHistoryItem } from '../types';
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
  const { currentShopId } = useAuth();
  const category = isCashHistoryCategory(categoryParam) ? categoryParam : null;
  const [items, setItems] = useState<CashHistoryItem[]>([]);
  const [cursor, setCursor] = useState<CashHistoryCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    const activeRequest = ++requestId.current;
    setItems([]);
    setCursor(null);
    setHasMore(false);
    setError('');

    if (!category || !currentShopId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void getCashCategoryHistoryPage(currentShopId, category)
      .then((page) => {
        if (activeRequest !== requestId.current) return;
        setItems(page.items);
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
      })
      .catch((loadError) => {
        if (activeRequest !== requestId.current) return;
        setError(getFriendlyCashError(loadError, 'history'));
      })
      .finally(() => {
        if (activeRequest === requestId.current) setLoading(false);
      });

    return () => {
      requestId.current += 1;
    };
  }, [category, currentShopId]);

  const loadMore = async () => {
    if (!category || !currentShopId || !cursor || loadingMore) return;
    const activeRequest = ++requestId.current;
    setLoadingMore(true);
    setError('');
    try {
      const page = await getCashCategoryHistoryPage(currentShopId, category, cursor);
      if (activeRequest !== requestId.current) return;
      setItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (loadError) {
      if (activeRequest !== requestId.current) return;
      setError(getFriendlyCashError(loadError, 'history'));
    } finally {
      if (activeRequest === requestId.current) setLoadingMore(false);
    }
  };

  if (!category) return <Navigate to="/" replace />;
  const details = categoryDetails[category];

  return (
    <div className="page history-page">
      <PageHeader title={details.title} subtitle={`All entries for ${currentShopId ? getShopName(currentShopId) : 'this shop'}`} backTo="/" />
      {error ? <div className="notice error" role="alert">{error}</div> : null}
      {loading ? (
        <div className="history-loading" role="status">
          <div className="loading-spinner" aria-hidden="true" />
          Loading entries...
        </div>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <div className="empty-state">
          <History size={30} />
          <h2>No entries</h2>
          <p>{details.empty}</p>
        </div>
      ) : null}
      {items.length > 0 ? <CashHistoryList items={items} /> : null}
      {hasMore && !loading ? (
        <button className="secondary-button history-load-more" type="button" onClick={() => void loadMore()} disabled={loadingMore}>
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      ) : null}
    </div>
  );
};
