import { ArrowRightLeft, History, Plus, RefreshCw, ReceiptText, TrendingDown, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCash } from '../context/CashContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { formatMoney } from '../utils/cash';

interface HomeLocationState {
  notice?: string;
}

const formatUpdatedAt = (value: ReturnType<typeof useCash>['summary'] extends infer _Summary ? unknown : never) => {
  if (!value) return '';
  const date = typeof value === 'string'
    ? new Date(value)
    : typeof value === 'object' && value !== null && 'toDate' in value
      ? (value as { toDate: () => Date }).toDate()
      : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export const HomePage = () => {
  const { profile } = useAuth();
  const { summary, summaryError, summaryLoading, refreshSummary } = useCash();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const [notice, setNotice] = useState(() => (location.state as HomeLocationState | null)?.notice || '');

  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const canUseBalance = Boolean(summary) && online && !summaryLoading;

  return (
    <div className="page home-page">
      <section className="home-intro">
        <div>
          <span className="eyebrow">WELCOME</span>
          <h1>{profile?.name || 'Staff'}</h1>
        </div>
        <button
          className="icon-button refresh-button"
          type="button"
          onClick={() => void refreshSummary()}
          disabled={summaryLoading || !online}
          title="Refresh available amount"
          aria-label="Refresh available amount"
        >
          <RefreshCw size={21} className={summaryLoading ? 'spin' : ''} />
        </button>
      </section>

      {notice ? <div className="notice success" role="status">{notice}</div> : null}
      {summaryError ? <div className="notice error" role="alert">{summaryError}</div> : null}

      <section className="balance-panel" aria-label="Available amount">
        <div className="balance-label">AVAILABLE AMOUNT</div>
        {summaryLoading ? <div className="balance-skeleton" /> : <div className="balance-value">{formatMoney(summary?.availableBalance ?? 0)}</div>}
        <div className="balance-updated">
          {summary?.updatedAt ? `Updated ${formatUpdatedAt(summary.updatedAt)}` : 'Live branch balance'}
        </div>
      </section>

      <section className="summary-grid" aria-label="Cash totals">
        <div className="summary-item">
          <ReceiptText size={20} />
          <span>Collections</span>
          <strong>{formatMoney(summary?.totalCollections ?? 0)}</strong>
        </div>
        <div className="summary-item expense-tone">
          <TrendingDown size={20} />
          <span>Expenses</span>
          <strong>{formatMoney(summary?.totalExpenses ?? 0)}</strong>
        </div>
        <div className="summary-item incoming-tone">
          <TrendingUp size={20} />
          <span>Transferred in</span>
          <strong>{formatMoney(summary?.totalTransferredIn ?? 0)}</strong>
        </div>
        <div className="summary-item outgoing-tone">
          <ArrowRightLeft size={20} />
          <span>Transferred out</span>
          <strong>{formatMoney(summary?.totalTransferredOut ?? 0)}</strong>
        </div>
      </section>

      <section className="home-actions" aria-label="Cash actions">
        <button className="primary-button action-button" type="button" onClick={() => navigate('/expense')} disabled={!canUseBalance}>
          <Plus size={23} /> Add expense
        </button>
        <button className="secondary-button action-button" type="button" onClick={() => navigate('/transfer')} disabled={!canUseBalance}>
          <ArrowRightLeft size={23} /> Transfer money
        </button>
        <button className="text-action" type="button" onClick={() => navigate('/history')}>
          <History size={21} /> View history
        </button>
      </section>
    </div>
  );
};
