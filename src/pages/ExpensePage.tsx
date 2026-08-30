import { IndianRupee, Save } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { ExpenseCategoryIcon } from '../components/ExpenseCategoryIcon';
import { WholeRupeeInput } from '../components/WholeRupeeInput';
import { useAuth } from '../context/AuthContext';
import { useCash } from '../context/CashContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { createExpense, createExpenseId, getFriendlyCashError } from '../services/cashService';
import type { ExpenseCategory } from '../types';
import {
  MAX_DESCRIPTION_LENGTH,
  formatMoney,
  isShopCashInitialized,
  isValidMoneyAmount,
  parseMoneyInput,
  validateDescription
} from '../utils/cash';
import {
  EXPENSE_CATEGORIES,
  getExpenseDescriptionForCategory,
  resolveExpenseDetails
} from '../utils/expenseCategories';

export const ExpensePage = () => {
  const { currentShopId, firebaseUser } = useAuth();
  const { summary, applyExpenseLocally } = useCash();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const operationId = useRef<string | null>(null);
  const [category, setCategory] = useState<ExpenseCategory | ''>('');
  const [amountText, setAmountText] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetOperationId = () => {
    if (!submitting) operationId.current = null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!online) {
      setError('Connect to the internet before saving an expense.');
      return;
    }
    if (!summary || !isShopCashInitialized(summary) || !currentShopId || !firebaseUser) {
      setError('Available amount is not ready. Return home and refresh.');
      return;
    }

    const amount = parseMoneyInput(amountText);
    if (!isValidMoneyAmount(amount)) {
      setError('Enter a whole rupee amount greater than zero.');
      return;
    }
    const expenseDetails = resolveExpenseDetails(category, description);
    const descriptionError = validateDescription(expenseDetails.description);
    if (descriptionError) {
      setError(descriptionError);
      return;
    }

    operationId.current ||= createExpenseId();
    setSubmitting(true);
    setError('');
    try {
      await createExpense({
        id: operationId.current,
        shopId: currentShopId,
        amount,
        category: expenseDetails.category,
        description: expenseDetails.description,
        createdBy: firebaseUser.uid
      });
      applyExpenseLocally(amount);
      operationId.current = null;
      navigate('/', { replace: true, state: { notice: 'Expense added successfully.' } });
    } catch (saveError) {
      setError(getFriendlyCashError(saveError, 'expense'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page form-page">
      <PageHeader title="Add expense" subtitle={`Available ${formatMoney(summary?.availableBalance ?? 0)}`} />
      {error ? <div className="notice error" role="alert">{error}</div> : null}

      <form className="cash-form" onSubmit={handleSubmit}>
        <label>
          Amount
          <span className="money-input">
            <IndianRupee size={21} />
            <WholeRupeeInput
              value={amountText}
              onValueChange={(value) => {
                setAmountText(value);
                resetOperationId();
              }}
              disabled={submitting}
              autoFocus
            />
          </span>
        </label>

        <label>
          Reason / explanation
          <textarea
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              resetOperationId();
            }}
            maxLength={MAX_DESCRIPTION_LENGTH}
            rows={4}
            placeholder="Example: Fuel for delivery"
            disabled={submitting}
          />
          <span className="field-count">{description.length}/{MAX_DESCRIPTION_LENGTH}</span>
        </label>

        <fieldset className="expense-category-fieldset">
          <legend>Expense category</legend>
          <div className="expense-category-grid">
            {EXPENSE_CATEGORIES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={category === option.id ? 'selected' : ''}
                aria-pressed={category === option.id}
                disabled={submitting}
                onClick={() => {
                  setDescription((current) => getExpenseDescriptionForCategory(current, category, option.id));
                  setCategory(option.id);
                  resetOperationId();
                }}
              >
                <ExpenseCategoryIcon category={option.id} size={22} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <button
          className="primary-button submit-button"
          type="submit"
          disabled={submitting || !online || !summary || !isShopCashInitialized(summary)}
        >
          <Save size={21} /> {submitting ? 'Saving...' : 'Save expense'}
        </button>
      </form>
    </div>
  );
};
