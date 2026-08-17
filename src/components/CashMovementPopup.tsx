import { ArrowDownLeft, ArrowUpRight, Banknote } from 'lucide-react';
import { useEffect } from 'react';
import type { CashMovement } from '../types';
import { formatMoney } from '../utils/cash';

const movementLabels: Record<CashMovement['kind'], string> = {
  collection: 'Payment received',
  expense: 'Expense paid',
  'transfer-in': 'Transfer received',
  'transfer-out': 'Money transferred',
  initialization: 'Opening cash added',
  adjustment: 'Cash balance changed'
};

export const CashMovementPopup = ({ movement, onClose }: { movement: CashMovement; onClose: () => void }) => {
  const incoming = movement.direction === 'in';
  const DirectionIcon = incoming ? ArrowDownLeft : ArrowUpRight;
  const movementLabel = movement.kind === 'adjustment'
    ? incoming ? 'Admin amount added' : 'Admin amount deducted'
    : movementLabels[movement.kind];

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className={`cash-movement-backdrop ${incoming ? 'money-in' : 'money-out'}`}>
      <section className="cash-movement-dialog" role="dialog" aria-modal="true" aria-labelledby="cash-movement-title">
        <div className="cash-movement-visual" aria-hidden="true">
          <div className="cash-note"><Banknote size={54} strokeWidth={1.8} /></div>
          <div className="cash-direction-icon"><DirectionIcon size={25} strokeWidth={2.6} /></div>
        </div>
        <div className="cash-movement-label">{movementLabel}</div>
        <div className="cash-movement-amount">
          {incoming ? '+' : '-'}{formatMoney(movement.amount)}
        </div>
        <h2 id="cash-movement-title">{incoming ? 'Cash came in' : 'Cash moved out'}</h2>
        <p>Available amount is now <strong>{formatMoney(movement.balance)}</strong>.</p>
        <button className="cash-movement-button" type="button" onClick={onClose} autoFocus>
          Continue
        </button>
      </section>
    </div>
  );
};
