import type { CashHistoryItem, ShopCashSummary, ShopId } from '../types';

export const MAX_MONEY_AMOUNT = 100_000_000;
export const MAX_DESCRIPTION_LENGTH = 160;

export const parseMoneyInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return Number.NaN;
  return Number(trimmed);
};

export const isValidMoneyAmount = (amount: number) => {
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_MONEY_AMOUNT) return false;
  return Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001;
};

export const validateDescription = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter a reason for this expense.';
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) return `Keep the reason within ${MAX_DESCRIPTION_LENGTH} characters.`;
  return null;
};

export const formatMoney = (amount: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  maximumFractionDigits: 2
}).format(amount);

export const applyExpenseToSummary = (summary: ShopCashSummary, amount: number): ShopCashSummary => ({
  ...summary,
  availableBalance: summary.availableBalance - amount,
  totalExpenses: summary.totalExpenses + amount,
  updatedAt: new Date().toISOString()
});

export const applyTransferToSummary = (
  summary: ShopCashSummary,
  amount: number,
  direction: 'in' | 'out'
): ShopCashSummary => direction === 'out'
  ? {
      ...summary,
      availableBalance: summary.availableBalance - amount,
      totalTransferredOut: summary.totalTransferredOut + amount,
      updatedAt: new Date().toISOString()
    }
  : {
      ...summary,
      availableBalance: summary.availableBalance + amount,
      totalTransferredIn: summary.totalTransferredIn + amount,
      updatedAt: new Date().toISOString()
    };

const historyTime = (item: CashHistoryItem) => item.createdAt?.toMillis() ?? 0;

export const mergeRecentHistory = (groups: CashHistoryItem[][], maximum = 20) => groups
  .flat()
  .sort((left, right) => historyTime(right) - historyTime(left))
  .slice(0, maximum);

export const createEmptyShopSummary = (shopId: ShopId): ShopCashSummary => ({
  shopId,
  availableBalance: 0,
  totalCollections: 0,
  totalExpenses: 0,
  totalTransferredIn: 0,
  totalTransferredOut: 0
});
