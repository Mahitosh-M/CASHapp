import { isWholeRupeeInput, MAX_MONEY_AMOUNT } from '../utils/cash';

interface WholeRupeeInputProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

const MAX_RUPEE_DIGITS = String(MAX_MONEY_AMOUNT).length;

export const WholeRupeeInput = ({ value, onValueChange, disabled, autoFocus }: WholeRupeeInputProps) => (
  <input
    type="text"
    inputMode="numeric"
    pattern="[0-9]*"
    maxLength={MAX_RUPEE_DIGITS}
    value={value}
    onChange={(event) => {
      if (isWholeRupeeInput(event.target.value)) onValueChange(event.target.value);
    }}
    placeholder="0"
    disabled={disabled}
    autoFocus={autoFocus}
  />
);
