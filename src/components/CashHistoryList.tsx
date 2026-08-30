import { ArrowDownLeft, ArrowUpRight, CircleMinus, CirclePlus, IndianRupee, Pencil, ReceiptText } from 'lucide-react';
import type { CashHistoryItem } from '../types';
import { formatMoney } from '../utils/cash';
import { getExpenseCategoryLabel } from '../utils/expenseCategories';
import { ExpenseCategoryIcon } from './ExpenseCategoryIcon';

const getActivityDate = (item: CashHistoryItem) => {
  if (!item.createdAt) return null;
  return typeof item.createdAt === 'string' ? new Date(item.createdAt) : item.createdAt.toDate();
};

const formatActivityTime = (item: CashHistoryItem) => {
  const date = getActivityDate(item);
  if (!date || Number.isNaN(date.getTime())) return 'Just now';
  const today = new Date();
  const sameDay = date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();

  return sameDay
    ? `Today, ${new Intl.DateTimeFormat('en-IN', { timeStyle: 'short' }).format(date)}`
    : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const ActivityIcon = ({ item }: { item: CashHistoryItem }) => {
  if (item.kind === 'collection') return <IndianRupee size={21} />;
  if (item.kind === 'transfer-in') return <ArrowDownLeft size={21} />;
  if (item.kind === 'transfer-out') return <ArrowUpRight size={21} />;
  if (item.kind === 'adjustment-in') return <CirclePlus size={21} />;
  if (item.kind === 'adjustment-out') return <CircleMinus size={21} />;
  if (item.kind === 'expense') return <ExpenseCategoryIcon category={item.expenseCategory ?? 'other'} size={21} />;
  return <ReceiptText size={21} />;
};

export const CashHistoryList = ({
  items,
  onEditTransfer,
  onEditExpense
}: {
  items: CashHistoryItem[];
  onEditTransfer?: (transferId: string) => void;
  onEditExpense?: (expenseId: string) => void;
}) => (
  <div className="history-list">
    {items.map((item) => {
      const positive = item.kind === 'collection' || item.kind === 'transfer-in' || item.kind === 'adjustment-in';
      return (
        <article className={`history-row ${positive ? 'positive' : 'negative'}`} key={`${item.kind}-${item.id}`}>
          <div className="history-icon"><ActivityIcon item={item} /></div>
          <div className="history-copy">
            <strong>{item.title}</strong>
            {item.detail ? <span>{item.detail}</span> : null}
            <time>{formatActivityTime(item)}</time>
          </div>
          <div className="history-side">
            <div className="history-amount">{positive ? '+' : '-'} {formatMoney(item.amount)}</div>
            {item.kind === 'transfer-out' && onEditTransfer ? (
              <button
                className="icon-button history-edit-button"
                type="button"
                onClick={() => onEditTransfer(item.id)}
                title="Edit transfer"
                aria-label={`Edit transfer of ${formatMoney(item.amount)}`}
              >
                <Pencil size={17} />
              </button>
            ) : null}
            {item.kind === 'expense' && onEditExpense ? (
              <button
                className="icon-button history-edit-button"
                type="button"
                onClick={() => onEditExpense(item.id)}
                title="Correct cash entry"
                aria-label={`Correct ${getExpenseCategoryLabel(item.expenseCategory ?? 'other')} entry of ${formatMoney(item.amount)}`}
              >
                <Pencil size={17} />
              </button>
            ) : null}
          </div>
        </article>
      );
    })}
  </div>
);
