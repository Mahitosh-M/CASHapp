import { IndianRupee, Save, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AutoGrowTextarea } from '../components/AutoGrowTextarea';
import { PageHeader } from '../components/PageHeader';
import { WholeRupeeInput } from '../components/WholeRupeeInput';
import { useAuth } from '../context/AuthContext';
import { useCash } from '../context/CashContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  deleteExpense,
  getExpense,
  getFriendlyCashError,
  updateExpense
} from '../services/cashService';
import type { CashExpenseRecord, ExpenseCategory } from '../types';
import {
  MAX_DESCRIPTION_LENGTH,
  formatMoney,
  isShopCashInitialized,
  isValidMoneyAmount,
  parseMoneyInput,
  validateDescription
} from '../utils/cash';
import { CASH_OUTFLOW_CATEGORIES, getExpenseCategoryLabel } from '../utils/expenseCategories';

interface EditExpenseLocationState {
  returnTo?: unknown;
}

const getReturnPath = (state: EditExpenseLocationState | null) => (
  typeof state?.returnTo === 'string' && state.returnTo.startsWith('/history')
    ? state.returnTo
    : '/history/expenses'
);

export const EditExpensePage = () => {
  const { expenseId } = useParams<{ expenseId: string }>();
  const { currentShopId, firebaseUser, profile } = useAuth();
  const { summary, applyExpenseEditLocally, applyExpenseDeletionLocally } = useCash();
  const online = useOnlineStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = getReturnPath(location.state as EditExpenseLocationState | null);
  const requestId = useRef(0);
  const [expense, setExpense] = useState<CashExpenseRecord | null>(null);
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const activeRequest = ++requestId.current;
    setExpense(null);
    setLoading(true);
    setError('');
    setConfirming(false);
    setConfirmingDelete(false);

    if (!expenseId || !currentShopId || profile?.role !== 'Admin') {
      setLoading(false);
      return;
    }

    void getExpense(expenseId)
      .then((record) => {
        if (activeRequest !== requestId.current) return;
        if (!record) {
          setError('Cash outflow entry was not found.');
          return;
        }
        if (record.shopId !== currentShopId) {
          setError('This entry belongs to a different shop.');
          return;
        }
        setExpense(record);
        setAmountText(String(record.amount));
        setCategory(record.category);
        setDescription(record.description);
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
  }, [currentShopId, expenseId, profile?.role]);

  if (!expenseId || profile?.role !== 'Admin') return <Navigate to={returnTo} replace />;

  const amount = parseMoneyInput(amountText);
  const normalizedDescription = description.trim();

  const validate = () => {
    if (!online) return 'Connect to the internet before updating this entry.';
    if (!expense || !summary || !isShopCashInitialized(summary) || !currentShopId || !firebaseUser) {
      return 'Entry details are not ready. Return to history and try again.';
    }
    if (expense.shopId !== currentShopId) return 'This entry belongs to a different shop.';
    if (!isValidMoneyAmount(amount)) return 'Enter a whole rupee amount greater than zero.';
    const descriptionError = validateDescription(normalizedDescription);
    if (descriptionError) return descriptionError;
    if (
      amount === expense.amount
      && category === expense.category
      && normalizedDescription === expense.description.trim()
    ) return 'Change the amount, category, or explanation before updating.';
    return '';
  };

  const handlePrepare = (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setConfirming(true);
  };

  const handleConfirm = async () => {
    if (submitting || !expense || !firebaseUser) return;
    const validationError = validate();
    if (validationError) {
      setConfirming(false);
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await updateExpense({
        id: expense.id,
        amount,
        category,
        description: normalizedDescription,
        updatedBy: firebaseUser.uid
      });
      applyExpenseEditLocally(result.previousAmount, result.amount);
      navigate(returnTo, { replace: true });
    } catch (saveError) {
      setConfirming(false);
      setError(getFriendlyCashError(saveError, 'expense-edit'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePrepare = () => {
    if (submitting) return;
    if (!online) {
      setError('Connect to the internet before deleting this entry.');
      return;
    }
    if (!expense || !firebaseUser) {
      setError('Entry details are not ready. Return to history and try again.');
      return;
    }
    setError('');
    setConfirmingDelete(true);
  };

  const handleDeleteConfirm = async () => {
    if (submitting || !expense || !firebaseUser) return;
    setSubmitting(true);
    setError('');
    try {
      const deletedExpense = await deleteExpense(expense.id, firebaseUser.uid);
      applyExpenseDeletionLocally(deletedExpense.amount);
      navigate(returnTo, { replace: true });
    } catch (deleteError) {
      setConfirmingDelete(false);
      setError(getFriendlyCashError(deleteError, 'expense-delete'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page form-page">
      <PageHeader
        title="Correct Cash Entry"
        subtitle={expense ? `Original ${formatMoney(expense.amount)} / ${getExpenseCategoryLabel(expense.category)}` : undefined}
        backTo={returnTo}
      />
      {error ? <div className="notice error" role="alert">{error}</div> : null}
      {loading ? (
        <div className="history-loading" role="status">
          <div className="loading-spinner" aria-hidden="true" />
          Loading entry...
        </div>
      ) : null}

      {!loading && expense ? (
        <form className="cash-form" onSubmit={handlePrepare}>
          <label>
            Amount
            <span className="money-input">
              <IndianRupee size={21} />
              <WholeRupeeInput value={amountText} onValueChange={setAmountText} disabled={submitting} autoFocus />
            </span>
          </label>

          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategory)} disabled={submitting}>
              {CASH_OUTFLOW_CATEGORIES.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            Reason / Explanation
            <AutoGrowTextarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={MAX_DESCRIPTION_LENGTH}
              disabled={submitting}
            />
            <span className="field-count">{description.length}/{MAX_DESCRIPTION_LENGTH}</span>
          </label>

          <button className="primary-button submit-button" type="submit" disabled={submitting || !online}>
            <Save size={21} /> Review Changes
          </button>
          <button className="danger-button transfer-delete-button" type="button" disabled={submitting || !online} onClick={handleDeletePrepare}>
            <Trash2 size={20} /> Delete Entry
          </button>
        </form>
      ) : null}

      {confirming && expense ? (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-expense-edit-title">
            <div className="confirm-icon adjustment"><Save size={22} /></div>
            <h2 id="confirm-expense-edit-title">Confirm Entry Correction</h2>
            <p>
              {formatMoney(expense.amount)} to <strong>{formatMoney(amount)}</strong><br />
              {getExpenseCategoryLabel(expense.category)} to <strong>{getExpenseCategoryLabel(category)}</strong>
            </p>
            <div className="dialog-actions">
              <button className="secondary-button" type="button" disabled={submitting} onClick={() => setConfirming(false)}>Cancel</button>
              <button className="primary-button" type="button" disabled={submitting} onClick={() => void handleConfirm()}>
                {submitting ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {confirmingDelete && expense ? (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-expense-delete-title">
            <div className="confirm-icon delete-confirm-icon"><Trash2 size={23} /></div>
            <h2 id="confirm-expense-delete-title">Delete Cash Entry?</h2>
            <p>
              Delete <strong>{formatMoney(expense.amount)}</strong> for {getExpenseCategoryLabel(expense.category)}?
              The amount will be restored to the available balance.
            </p>
            <div className="dialog-actions">
              <button className="secondary-button" type="button" disabled={submitting} onClick={() => setConfirmingDelete(false)}>Cancel</button>
              <button className="danger-button" type="button" disabled={submitting} onClick={() => void handleDeleteConfirm()}>
                <Trash2 size={19} /> {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};
