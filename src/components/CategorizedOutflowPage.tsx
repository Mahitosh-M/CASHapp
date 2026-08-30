import { IndianRupee, Save } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { getExpenseCategoryLabel } from '../utils/expenseCategories';
import { AutoGrowTextarea } from './AutoGrowTextarea';
import { PageHeader } from './PageHeader';
import { WholeRupeeInput } from './WholeRupeeInput';

interface CategorizedOutflowPageProps {
  category: Extract<ExpenseCategory, 'purchases' | 'emi'>;
  title: string;
  fieldLabel: string;
  placeholder: string;
  savedNotice: string;
  submitLabel: string;
}

export const CategorizedOutflowPage = ({
  category,
  title,
  fieldLabel,
  placeholder,
  savedNotice,
  submitLabel
}: CategorizedOutflowPageProps) => {
  const { currentShopId, firebaseUser } = useAuth();
  const { summary, applyExpenseLocally } = useCash();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const operationId = useRef<string | null>(null);
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
      setError(`Connect to the internet before saving ${category === 'emi' ? 'an EMI payment' : 'a purchase'}.`);
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

    const resolvedDescription = description.trim() || getExpenseCategoryLabel(category);
    const descriptionError = validateDescription(resolvedDescription);
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
        category,
        description: resolvedDescription,
        createdBy: firebaseUser.uid
      });
      applyExpenseLocally(amount);
      operationId.current = null;
      navigate('/', { replace: true, state: { notice: savedNotice } });
    } catch (saveError) {
      setError(getFriendlyCashError(saveError, category === 'emi' ? 'emi' : 'purchase'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page form-page">
      <PageHeader title={title} subtitle={`Available ${formatMoney(summary?.availableBalance ?? 0)}`} />
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
          {fieldLabel}
          <AutoGrowTextarea
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              resetOperationId();
            }}
            maxLength={MAX_DESCRIPTION_LENGTH}
            placeholder={placeholder}
            disabled={submitting}
          />
          <span className="field-count">{description.length}/{MAX_DESCRIPTION_LENGTH}</span>
        </label>

        <button
          className="primary-button submit-button"
          type="submit"
          disabled={submitting || !online || !summary || !isShopCashInitialized(summary)}
        >
          <Save size={21} /> {submitting ? 'Saving...' : submitLabel}
        </button>
      </form>
    </div>
  );
};
