import { CircleMinus, CirclePlus, IndianRupee, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useCash } from '../context/CashContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  createAdjustmentId,
  createCashAdjustment,
  getFriendlyCashError
} from '../services/cashService';
import type { CashAdjustmentDirection } from '../types';
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_MONEY_AMOUNT,
  formatMoney,
  isShopCashInitialized,
  isValidMoneyAmount,
  parseMoneyInput
} from '../utils/cash';
import { getShopName } from '../utils/shops';

export const AdminPage = () => {
  const { currentShopId, firebaseUser, profile } = useAuth();
  const { summary, applyAdjustmentLocally } = useCash();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const operationId = useRef<string | null>(null);
  const [direction, setDirection] = useState<CashAdjustmentDirection>('add');
  const [amountText, setAmountText] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    operationId.current = null;
    setDirection('add');
    setAmountText('');
    setReason('');
    setError('');
    setConfirming(false);
  }, [currentShopId]);

  if (profile?.role !== 'Admin') return <Navigate to="/" replace />;

  const amount = parseMoneyInput(amountText);
  const selectedShopName = currentShopId ? getShopName(currentShopId) : 'branch';

  const resetOperationId = () => {
    if (!submitting) operationId.current = null;
  };

  const validate = () => {
    if (!online) return 'Connect to the internet before adjusting the amount.';
    if (!summary || !isShopCashInitialized(summary) || !currentShopId || !firebaseUser) {
      return 'Available amount is not ready. Initialize this branch from Home first.';
    }
    if (!isValidMoneyAmount(amount)) {
      return 'Enter a valid amount greater than zero, with no more than two decimal places.';
    }
    if (direction === 'deduct' && amount > summary.availableBalance) {
      return 'Deduction cannot exceed the available amount.';
    }
    if (!reason.trim()) return 'Enter a reason for this adjustment.';
    if (reason.trim().length > MAX_DESCRIPTION_LENGTH) {
      return `Keep the reason within ${MAX_DESCRIPTION_LENGTH} characters.`;
    }
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
    operationId.current ||= createAdjustmentId();
    setError('');
    setConfirming(true);
  };

  const handleConfirm = async () => {
    if (submitting || !operationId.current || !currentShopId || !firebaseUser) return;
    const validationError = validate();
    if (validationError) {
      setConfirming(false);
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await createCashAdjustment({
        id: operationId.current,
        shopId: currentShopId,
        amount,
        direction,
        reason: reason.trim(),
        createdBy: firebaseUser.uid
      });
      applyAdjustmentLocally(amount, direction);
      operationId.current = null;
      navigate('/', {
        replace: true,
        state: {
          notice: `${formatMoney(amount)} ${direction === 'add' ? 'added to' : 'deducted from'} ${selectedShopName}.`
        }
      });
    } catch (saveError) {
      setConfirming(false);
      setError(getFriendlyCashError(saveError, 'adjustment'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page admin-page">
      <PageHeader title="Adjust amount" subtitle={`Admin control for ${selectedShopName}`} />
      {error ? <div className="notice error" role="alert">{error}</div> : null}

      <section className="admin-current-balance" aria-label="Current available amount">
        <span>CURRENT AVAILABLE</span>
        <strong>{formatMoney(summary?.availableBalance ?? 0)}</strong>
      </section>

      <form className="cash-form admin-adjustment-form" onSubmit={handlePrepare}>
        <div className="adjustment-direction" role="group" aria-label="Adjustment type">
          <button
            type="button"
            className={direction === 'add' ? 'selected add' : ''}
            aria-pressed={direction === 'add'}
            disabled={submitting}
            onClick={() => {
              setDirection('add');
              resetOperationId();
            }}
          >
            <CirclePlus size={21} /> Add amount
          </button>
          <button
            type="button"
            className={direction === 'deduct' ? 'selected deduct' : ''}
            aria-pressed={direction === 'deduct'}
            disabled={submitting}
            onClick={() => {
              setDirection('deduct');
              resetOperationId();
            }}
          >
            <CircleMinus size={21} /> Deduct amount
          </button>
        </div>

        <label>
          Amount
          <span className="money-input">
            <IndianRupee size={21} />
            <input
              type="number"
              min="0.01"
              max={MAX_MONEY_AMOUNT}
              step="0.01"
              inputMode="decimal"
              value={amountText}
              onChange={(event) => {
                setAmountText(event.target.value);
                resetOperationId();
              }}
              placeholder="0"
              disabled={submitting}
              autoFocus
            />
          </span>
        </label>

        <label>
          Reason
          <textarea
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              resetOperationId();
            }}
            maxLength={MAX_DESCRIPTION_LENGTH}
            rows={4}
            placeholder="Example: Opening transaction correction"
            disabled={submitting}
          />
          <span className="field-count">{reason.length}/{MAX_DESCRIPTION_LENGTH}</span>
        </label>

        <button
          className={`primary-button submit-button adjustment-submit ${direction}`}
          type="submit"
          disabled={submitting || !online || !summary || !isShopCashInitialized(summary)}
        >
          <SlidersHorizontal size={21} /> Review adjustment
        </button>
      </form>

      {confirming ? (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-adjustment-title">
            <div className={`confirm-icon adjustment ${direction}`}>
              {direction === 'add' ? <CirclePlus size={27} /> : <CircleMinus size={27} />}
            </div>
            <h2 id="confirm-adjustment-title">Confirm {direction === 'add' ? 'addition' : 'deduction'}</h2>
            <p>
              {direction === 'add' ? 'Add' : 'Deduct'} <strong>{formatMoney(amount)}</strong>{' '}
              {direction === 'add' ? 'to' : 'from'} {selectedShopName}?
            </p>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={submitting}
                onClick={() => {
                  setConfirming(false);
                  operationId.current = null;
                }}
              >
                Cancel
              </button>
              <button className="primary-button" type="button" disabled={submitting} onClick={() => void handleConfirm()}>
                {submitting ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};
