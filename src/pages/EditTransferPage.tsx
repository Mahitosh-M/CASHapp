import { IndianRupee, Save, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AutoGrowTextarea } from '../components/AutoGrowTextarea';
import { CashFlowArrows } from '../components/CashFlowArrows';
import { PageHeader } from '../components/PageHeader';
import { WholeRupeeInput } from '../components/WholeRupeeInput';
import { useAuth } from '../context/AuthContext';
import { useCash } from '../context/CashContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  INSUFFICIENT_TRANSFER_EDIT_BALANCE,
  deleteTransfer,
  getFriendlyCashError,
  getTransfer,
  updateTransfer
} from '../services/cashService';
import type { ShopTransferRecord } from '../types';
import {
  MAX_DESCRIPTION_LENGTH,
  formatMoney,
  isShopCashInitialized,
  isValidMoneyAmount,
  parseMoneyInput
} from '../utils/cash';
import { getShopName } from '../utils/shops';

interface EditTransferLocationState {
  returnTo?: unknown;
}

const getReturnPath = (state: EditTransferLocationState | null) => (
  typeof state?.returnTo === 'string' && state.returnTo.startsWith('/history')
    ? state.returnTo
    : '/history/transfers-out'
);

export const EditTransferPage = () => {
  const { transferId } = useParams<{ transferId: string }>();
  const { currentShopId, firebaseUser, profile } = useAuth();
  const { summary, applyTransferEditLocally, applyTransferDeletionLocally } = useCash();
  const online = useOnlineStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = getReturnPath(location.state as EditTransferLocationState | null);
  const requestId = useRef(0);
  const [transfer, setTransfer] = useState<ShopTransferRecord | null>(null);
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const activeRequest = ++requestId.current;
    setTransfer(null);
    setLoading(true);
    setError('');
    setConfirming(false);
    setConfirmingDelete(false);

    if (!transferId || !currentShopId) {
      setLoading(false);
      return;
    }

    void getTransfer(transferId)
      .then((record) => {
        if (activeRequest !== requestId.current) return;
        if (!record) {
          setError('Transfer entry was not found.');
          return;
        }
        if (record.fromShopId !== currentShopId) {
          setError('Only the sending shop can edit this transfer.');
          return;
        }
        setTransfer(record);
        setAmountText(String(record.amount));
        setNote(record.note);
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
  }, [currentShopId, transferId]);

  if (!transferId) return <Navigate to={returnTo} replace />;

  const amount = parseMoneyInput(amountText);
  const amountDifference = transfer && Number.isFinite(amount) ? amount - transfer.amount : 0;
  const normalizedNote = note.trim();

  const validate = () => {
    if (!online) return 'Connect to the internet before updating this transfer.';
    if (!transfer || !summary || !isShopCashInitialized(summary) || !currentShopId || !firebaseUser) {
      return 'Transfer details are not ready. Return to history and try again.';
    }
    if (transfer.fromShopId !== currentShopId) return 'Only the sending shop can edit this transfer.';
    if (!isValidMoneyAmount(amount)) return 'Enter a whole rupee amount greater than zero.';
    if (amountDifference > 0 && summary.availableBalance - amountDifference < 0) {
      return INSUFFICIENT_TRANSFER_EDIT_BALANCE;
    }
    if (normalizedNote.length > MAX_DESCRIPTION_LENGTH) {
      return `Keep the note within ${MAX_DESCRIPTION_LENGTH} characters.`;
    }
    if (amountDifference === 0 && normalizedNote === transfer.note.trim()) {
      return 'Change the amount or note before updating.';
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
    setError('');
    setConfirming(true);
  };

  const handleConfirm = async () => {
    if (submitting || !transfer || !firebaseUser) return;
    const validationError = validate();
    if (validationError) {
      setConfirming(false);
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await updateTransfer({
        id: transfer.id,
        amount,
        note: normalizedNote,
        updatedBy: firebaseUser.uid
      });
      if (result.amountDifference !== 0) applyTransferEditLocally(result.amountDifference);
      navigate(returnTo, { replace: true });
    } catch (saveError) {
      setConfirming(false);
      setError(saveError instanceof Error && saveError.message === INSUFFICIENT_TRANSFER_EDIT_BALANCE
        ? saveError.message
        : getFriendlyCashError(saveError, 'transfer'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePrepare = () => {
    if (submitting) return;
    if (!online) {
      setError('Connect to the internet before deleting this transfer.');
      return;
    }
    if (profile?.role !== 'Admin' || !transfer || !firebaseUser) {
      setError('Only Admin can delete a transfer.');
      return;
    }
    setError('');
    setConfirmingDelete(true);
  };

  const handleDeleteConfirm = async () => {
    if (submitting || profile?.role !== 'Admin' || !transfer || !firebaseUser) return;
    setSubmitting(true);
    setError('');
    try {
      const deletedTransfer = await deleteTransfer(transfer.id);
      applyTransferDeletionLocally(deletedTransfer.amount);
      navigate(returnTo, { replace: true });
    } catch (deleteError) {
      setConfirmingDelete(false);
      setError(getFriendlyCashError(deleteError, 'transfer-delete'));
    } finally {
      setSubmitting(false);
    }
  };

  const differenceLabel = amountDifference > 0
    ? `Increase by ${formatMoney(amountDifference)}`
    : amountDifference < 0
      ? `Reduce by ${formatMoney(Math.abs(amountDifference))}`
      : 'Update note only';

  return (
    <div className="page form-page">
      <PageHeader
        title="Edit transfer"
        subtitle={transfer ? `Original amount ${formatMoney(transfer.amount)}` : undefined}
        backTo={returnTo}
      />
      {error ? <div className="notice error" role="alert">{error}</div> : null}
      {loading ? (
        <div className="history-loading" role="status">
          <div className="loading-spinner" aria-hidden="true" />
          Loading transfer...
        </div>
      ) : null}

      {!loading && transfer ? (
        <form className="cash-form" onSubmit={handlePrepare}>
          <div className="transfer-route" aria-label="Transfer route">
            <div><span>FROM</span><strong>{getShopName(transfer.fromShopId)}</strong></div>
            <CashFlowArrows className="transfer-route-arrows" size={20} />
            <div><span>TO</span><strong>{getShopName(transfer.toShopId)}</strong></div>
          </div>

          <label>
            Amount
            <span className="money-input">
              <IndianRupee size={21} />
              <WholeRupeeInput
                value={amountText}
                onValueChange={setAmountText}
                disabled={submitting}
                autoFocus
              />
            </span>
          </label>

          <label>
            Note <span className="optional-label">Optional</span>
            <AutoGrowTextarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={MAX_DESCRIPTION_LENGTH}
              disabled={submitting}
            />
            <span className="field-count">{note.length}/{MAX_DESCRIPTION_LENGTH}</span>
          </label>

          <button className="primary-button submit-button" type="submit" disabled={submitting || !online}>
            <Save size={21} /> Review changes
          </button>
          {profile?.role === 'Admin' ? (
            <button
              className="danger-button transfer-delete-button"
              type="button"
              disabled={submitting || !online}
              onClick={handleDeletePrepare}
            >
              <Trash2 size={20} /> Delete transfer
            </button>
          ) : null}
        </form>
      ) : null}

      {confirming && transfer ? (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-transfer-edit-title">
            <div className="confirm-icon transfer-confirm-icon"><CashFlowArrows size={20} /></div>
            <h2 id="confirm-transfer-edit-title">Confirm transfer update</h2>
            <p>
              {formatMoney(transfer.amount)} to <strong>{formatMoney(amount)}</strong><br />
              {differenceLabel}
            </p>
            <div className="dialog-actions">
              <button className="secondary-button" type="button" disabled={submitting} onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button className="primary-button" type="button" disabled={submitting} onClick={() => void handleConfirm()}>
                {submitting ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {confirmingDelete && transfer ? (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-transfer-delete-title">
            <div className="confirm-icon delete-confirm-icon"><Trash2 size={23} /></div>
            <h2 id="confirm-transfer-delete-title">Delete transfer?</h2>
            <p>
              Delete <strong>{formatMoney(transfer.amount)}</strong> from {getShopName(transfer.fromShopId)} to{' '}
              {getShopName(transfer.toShopId)}? Both shop balances will be reversed.
            </p>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={submitting}
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={submitting}
                onClick={() => void handleDeleteConfirm()}
              >
                <Trash2 size={19} /> {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};
