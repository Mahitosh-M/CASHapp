import {
  ArrowRightLeft,
  IndianRupee,
  Landmark,
  ReceiptIndianRupee,
  ReceiptText,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WholeRupeeInput } from '../components/WholeRupeeInput';
import { useAuth } from '../context/AuthContext';
import { useCash } from '../context/CashContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { getFriendlyCashError, initializeShopCash } from '../services/cashService';
import {
  formatMoney,
  isShopCashInitialized,
  isValidOpeningBalance,
  parseMoneyInput
} from '../utils/cash';
import { getShopName } from '../utils/shops';

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
  const { currentShopId, firebaseUser, profile } = useAuth();
  const {
    summary,
    summaryError,
    summaryLoading,
    applyInitializationLocally
  } = useCash();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const [notice, setNotice] = useState(() => (location.state as HomeLocationState | null)?.notice || '');
  const [openingBalanceText, setOpeningBalanceText] = useState('0');
  const [initializationError, setInitializationError] = useState('');
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    setOpeningBalanceText('0');
    setInitializationError('');
    setInitializing(false);
  }, [currentShopId]);

  const initialized = isShopCashInitialized(summary);
  const needsInitialization = !summaryLoading && !summaryError && !initialized;
  const canUseBalance = Boolean(summary) && initialized && online && !summaryLoading;

  const handleInitialize = async (event: FormEvent) => {
    event.preventDefault();
    if (initializing) return;
    if (!online) {
      setInitializationError('Connect to the internet before initializing branch cash.');
      return;
    }
    if (profile?.role !== 'Admin' || !currentShopId || !firebaseUser) {
      setInitializationError('Only Admin can initialize branch cash.');
      return;
    }

    const openingBalance = parseMoneyInput(openingBalanceText);
    if (!isValidOpeningBalance(openingBalance)) {
      setInitializationError('Enter zero or a valid whole rupee opening amount.');
      return;
    }

    setInitializing(true);
    setInitializationError('');
    try {
      await initializeShopCash({
        shopId: currentShopId,
        openingBalance,
        createdBy: firebaseUser.uid
      });
      applyInitializationLocally(openingBalance, firebaseUser.uid);
      setNotice(`${getShopName(currentShopId)} cash initialized successfully.`);
    } catch (error) {
      setInitializationError(getFriendlyCashError(error, 'initialize'));
    } finally {
      setInitializing(false);
    }
  };

  return (
    <div className="page home-page">
      {notice ? <div className="notice success" role="status">{notice}</div> : null}
      {summaryError ? <div className="notice error" role="alert">{summaryError}</div> : null}
      {needsInitialization && profile?.role === 'Staff' ? (
        <div className="notice error" role="alert">Branch cash has not been initialized. Please contact Admin.</div>
      ) : null}

      <section className="balance-panel" aria-label="Available amount">
        <div className="balance-label">AVAILABLE AMOUNT</div>
        {summaryLoading ? <div className="balance-skeleton" /> : (
          <div className={`balance-value ${(summary?.availableBalance ?? 0) < 0 ? 'negative' : ''}`}>
            {formatMoney(summary?.availableBalance ?? 0)}
          </div>
        )}
        <div className="balance-updated">
          {summary?.updatedAt ? `Updated ${formatUpdatedAt(summary.updatedAt)}` : 'Awaiting branch setup'}
        </div>
      </section>

      <section className="home-actions" aria-label="Cash actions">
        <button className="quick-action-tile expense-action" type="button" onClick={() => navigate('/expense')} disabled={!canUseBalance}>
          <span className="quick-action-icon" aria-hidden="true"><ReceiptIndianRupee size={29} /></span>
          <span>Add expense</span>
        </button>
        <button className="quick-action-tile transfer-action" type="button" onClick={() => navigate('/transfer')} disabled={!canUseBalance}>
          <span className="quick-action-icon" aria-hidden="true"><ArrowRightLeft size={29} /></span>
          <span>Transfer money</span>
        </button>
      </section>

      {needsInitialization && profile?.role === 'Admin' ? (
        <section className="initialization-panel" aria-labelledby="initialize-cash-title">
          <div className="initialization-heading">
            <div className="initialization-icon"><Landmark size={22} /></div>
            <div>
              <span className="eyebrow">ONE-TIME SETUP</span>
              <h2 id="initialize-cash-title">Initialize {currentShopId ? getShopName(currentShopId) : 'branch'}</h2>
            </div>
          </div>
          {initializationError ? <div className="notice error" role="alert">{initializationError}</div> : null}
          <form className="initialization-form" onSubmit={handleInitialize}>
            <label>
              Opening cash to add
              <span className="money-input">
                <IndianRupee size={21} />
                <WholeRupeeInput
                  value={openingBalanceText}
                  onValueChange={setOpeningBalanceText}
                  disabled={initializing}
                />
              </span>
            </label>
            <button className="primary-button" type="submit" disabled={initializing || !online}>
              <Landmark size={21} /> {initializing ? 'Initializing...' : 'Set opening balance'}
            </button>
          </form>
        </section>
      ) : null}

      <section className="summary-grid" aria-label="Cash totals">
        <button className="summary-item" type="button" onClick={() => navigate('/history/collections')}>
          <ReceiptText size={20} />
          <span>Collections</span>
          <strong>{formatMoney(summary?.totalCollections ?? 0)}</strong>
        </button>
        <button className="summary-item expense-tone" type="button" onClick={() => navigate('/history/expenses')}>
          <TrendingDown size={20} />
          <span>Expenses</span>
          <strong>{formatMoney(summary?.totalExpenses ?? 0)}</strong>
        </button>
        <button className="summary-item incoming-tone" type="button" onClick={() => navigate('/history/transfers-in')}>
          <TrendingUp size={20} />
          <span>Transferred in</span>
          <strong>{formatMoney(summary?.totalTransferredIn ?? 0)}</strong>
        </button>
        <button className="summary-item outgoing-tone" type="button" onClick={() => navigate('/history/transfers-out')}>
          <ArrowRightLeft size={20} />
          <span>Transferred out</span>
          <strong>{formatMoney(summary?.totalTransferredOut ?? 0)}</strong>
        </button>
      </section>
    </div>
  );
};
