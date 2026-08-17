import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface CashFlowArrowsProps {
  className?: string;
  size?: number;
}

export const CashFlowArrows = ({ className = '', size = 20 }: CashFlowArrowsProps) => (
  <span className={`cash-flow-arrows ${className}`.trim()} aria-hidden="true">
    <ArrowUpRight className="cash-flow-arrow-out" size={size} />
    <ArrowDownLeft className="cash-flow-arrow-in" size={size} />
  </span>
);
