import { ArrowRight, ArrowRightLeft, IndianRupee } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useCash } from '../context/CashContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { createTransfer, createTransferId, getFriendlyCashError } from '../services/cashService';
import { MAX_DESCRIPTION_LENGTH, MAX_MONEY_AMOUNT, formatMoney, isValidMoneyAmount, parseMoneyInput } from '../utils/cash';
import { getOtherShopId, getShopName } from '../utils/shops';

export const TransferPage = () => {
  const { currentShopId, firebaseUser } = useAuth();
  const { summary, applyTransferLocally } = useCash();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const operationId = useRef<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const destinationShopId = currentShopId ? getOtherShopId(currentShopId) : undefined;
  const amount = parseMoneyInput(amountText);

  const resetOperationId = () => {
    if (!submitting) operationId.current = null;
  };

  const validate = () => {
    if (!online) return 'Connect to the internet before transferring money.';
    if (!summary || !currentShopId || !destinationShopId || !firebaseUser) return 'Available amount is not ready. Return home and refresh.';
    if (!isValidMoneyAmount(amount)) return 'Enter a valid amount greater than zero, with no more than two decimal places.';
    if (amount > summary.availableBalance) return 'Insufficient available amount.';
    if (note.trim().length > MAX_DESCRIPTION_LENGTH) return `Keep the note within ${MAX_DESCRIPTION_LENGTH} characters.`;
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
    operationId.current ||= createTransferId();
    setError('');
    setConfirming(true);
  };

  const handleConfirm = async () => {
    if (submitting || !operationId.current || !currentShopId || !destinationShopId || !firebaseUser) return;
    const validationError = validate();
    if (validationError) {
      setConfirming(false);
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await createTransfer({
        id: operationId.current,
        fromShopId: currentShopId,
        toShopId: destinationShopId,
        amount,
        note: note.trim(),
        createdBy: firebaseUser.uid
      });
      applyTransferLocally(amount);
      operationId.current = null;
      navigate('/', {
        replace: true,
        state: { notice: `${formatMoney(amount)} transferred to ${getShopName(destinationShopId)} successfully.` }
      });
    } catch (saveError) {
      setConfirming(false);
      setError(getFriendlyCashError(saveError, 'transfer'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page form-page">
      <PageHeader title="Transfer money" subtitle={`Available ${formatMoney(summary?.availableBalance ?? 0)}`} />
      {error ? <div className="notice error" role="alert">{error}</div> : null}

      <form className="cash-form" onSubmit={handlePrepare}>
        <div className="transfer-route" aria-label="Transfer route">
          <div><span>FROM</span><strong>{currentShopId ? getShopName(currentShopId) : '-'}</strong></div>
          <ArrowRight size={23} />
          <div><span>TO</span><strong>{destinationShopId ? getShopName(destinationShopId) : '-'}</strong></div>
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
          Note <span className="optional-label">Optional</span>
          <textarea
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              resetOperationId();
            }}
            maxLength={MAX_DESCRIPTION_LENGTH}
            rows={3}
            placeholder="Example: Cash sent with delivery vehicle"
            disabled={submitting}
          />
          <span className="field-count">{note.length}/{MAX_DESCRIPTION_LENGTH}</span>
        </label>

        <button className="primary-button submit-button" type="submit" disabled={submitting || !online || !summary}>
          <ArrowRightLeft size={21} /> Transfer
        </button>
      </form>

      {confirming ? (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-transfer-title">
            <div className="confirm-icon"><ArrowRightLeft size={27} /></div>
            <h2 id="confirm-transfer-title">Confirm transfer</h2>
            <p>Transfer <strong>{formatMoney(amount)}</strong> from {getShopName(currentShopId!)} to {getShopName(destinationShopId!)}?</p>
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
                {submitting ? 'Transferring...' : 'Confirm'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};
