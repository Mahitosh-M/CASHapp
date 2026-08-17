import { ArrowDownLeft, ArrowUpRight, History, ReceiptText, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import { useCash } from '../context/CashContext';
import type { CashHistoryItem } from '../types';
import { formatMoney } from '../utils/cash';

const formatActivityTime = (item: CashHistoryItem) => {
  const date = item.createdAt?.toDate();
  if (!date) return 'Just now';
  const today = new Date();
  const sameDay = date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();

  return sameDay
    ? `Today, ${new Intl.DateTimeFormat('en-IN', { timeStyle: 'short' }).format(date)}`
    : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const ActivityIcon = ({ kind }: { kind: CashHistoryItem['kind'] }) => {
  if (kind === 'transfer-in') return <ArrowDownLeft size={21} />;
  if (kind === 'transfer-out') return <ArrowUpRight size={21} />;
  return <ReceiptText size={21} />;
};

export const HistoryPage = () => {
  const { history, historyError, historyLoading, loadHistory } = useCash();

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return (
    <div className="page history-page">
      <div className="history-heading-row">
        <PageHeader title="History" subtitle="Recent expenses and transfers" />
        <button
          className="icon-button refresh-button"
          type="button"
          onClick={() => void loadHistory(true)}
          disabled={historyLoading}
          title="Refresh history"
          aria-label="Refresh history"
        >
          <RefreshCw size={21} className={historyLoading ? 'spin' : ''} />
        </button>
      </div>

      {historyError ? <div className="notice error" role="alert">{historyError}</div> : null}
      {historyLoading && history.length === 0 ? (
        <div className="history-loading" role="status">
          <div className="loading-spinner" aria-hidden="true" />
          Loading recent activity...
        </div>
      ) : null}

      {!historyLoading && !historyError && history.length === 0 ? (
        <div className="empty-state">
          <History size={30} />
          <h2>No activity yet</h2>
          <p>Expenses and shop transfers will appear here.</p>
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="history-list">
          {history.map((item) => {
            const positive = item.kind === 'transfer-in';
            return (
              <article className={`history-row ${positive ? 'positive' : 'negative'}`} key={`${item.kind}-${item.id}`}>
                <div className="history-icon"><ActivityIcon kind={item.kind} /></div>
                <div className="history-copy">
                  <strong>{item.title}</strong>
                  {item.detail ? <span>{item.detail}</span> : null}
                  <time>{formatActivityTime(item)}</time>
                </div>
                <div className="history-amount">{positive ? '+' : '-'} {formatMoney(item.amount)}</div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
