import { ArrowDownLeft, ArrowUpRight, CircleMinus, CirclePlus, IndianRupee, ReceiptText } from 'lucide-react';
import type { CashHistoryItem } from '../types';
import { formatMoney } from '../utils/cash';

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

const ActivityIcon = ({ kind }: { kind: CashHistoryItem['kind'] }) => {
  if (kind === 'collection') return <IndianRupee size={21} />;
  if (kind === 'transfer-in') return <ArrowDownLeft size={21} />;
  if (kind === 'transfer-out') return <ArrowUpRight size={21} />;
  if (kind === 'adjustment-in') return <CirclePlus size={21} />;
  if (kind === 'adjustment-out') return <CircleMinus size={21} />;
  return <ReceiptText size={21} />;
};

export const CashHistoryList = ({ items }: { items: CashHistoryItem[] }) => (
  <div className="history-list">
    {items.map((item) => {
      const positive = item.kind === 'collection' || item.kind === 'transfer-in' || item.kind === 'adjustment-in';
      return (
        <article className={`history-row ${positive ? 'positive' : 'negative'}`} key={`${item.kind}-${item.id}`}>
          <div className="history-icon"><ActivityIcon kind={item.kind} /></div>
          <div className="history-copy">
            <strong>{item.title}</strong>
            {item.detail ? <span>{item.detail}</span> : null}
            <time>{formatActivityTime(item)}</time>
          </div>
          <div className="history-amount">{positive ? '+' : '-'} {formatMoney(item.amount)}</div>
        </article>
      );
    })}
  </div>
);
