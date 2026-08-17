import { History, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { CashHistoryList } from '../components/CashHistoryList';
import { PageHeader } from '../components/PageHeader';
import { useCash } from '../context/CashContext';

export const HistoryPage = () => {
  const { history, historyError, historyLoading, loadHistory } = useCash();

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return (
    <div className="page history-page">
      <div className="history-heading-row">
        <PageHeader title="History" subtitle="Recent cash activity" />
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

      {history.length > 0 ? <CashHistoryList items={history} /> : null}
    </div>
  );
};
