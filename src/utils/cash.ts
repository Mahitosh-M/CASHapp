import type {
  CashAdjustmentDirection,
  CashBalanceSnapshot,
  CashHistoryItem,
  CashMovement,
  ShopCashSummary,
  ShopId
} from '../types';

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

export const isValidOpeningBalance = (amount: number) => {
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_MONEY_AMOUNT) return false;
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

const toMoney = (amount: number) => Math.round(amount * 100) / 100;

export const createCashBalanceSnapshot = (summary: ShopCashSummary): CashBalanceSnapshot => ({
  availableBalance: toMoney(summary.availableBalance),
  totalCollections: toMoney(summary.totalCollections),
  totalExpenses: toMoney(summary.totalExpenses),
  totalTransferredIn: toMoney(summary.totalTransferredIn),
  totalTransferredOut: toMoney(summary.totalTransferredOut),
  openingBalance: toMoney(summary.openingBalance)
});

export const detectCashMovement = (
  previous: CashBalanceSnapshot,
  current: CashBalanceSnapshot
): CashMovement | null => {
  const balanceChange = toMoney(current.availableBalance - previous.availableBalance);
  if (balanceChange === 0) return null;

  const direction = balanceChange > 0 ? 'in' : 'out';
  let kind: CashMovement['kind'] = 'adjustment';

  if (direction === 'in') {
    if (current.totalTransferredIn > previous.totalTransferredIn) kind = 'transfer-in';
    else if (current.totalCollections > previous.totalCollections) kind = 'collection';
    else if (current.openingBalance > previous.openingBalance) kind = 'initialization';
  } else if (current.totalExpenses > previous.totalExpenses) {
    kind = 'expense';
  } else if (current.totalTransferredOut > previous.totalTransferredOut) {
    kind = 'transfer-out';
  }

  return {
    direction,
    kind,
    amount: Math.abs(balanceChange),
    balance: current.availableBalance
  };
};

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

export const getCashAdjustmentDelta = (amount: number, direction: CashAdjustmentDirection) => (
  direction === 'add' ? amount : -amount
);

export const applyAdjustmentToSummary = (
  summary: ShopCashSummary,
  amount: number,
  direction: CashAdjustmentDirection
): ShopCashSummary => ({
  ...summary,
  availableBalance: summary.availableBalance + getCashAdjustmentDelta(amount, direction),
  updatedAt: new Date().toISOString()
});

export const isShopCashInitialized = (summary: ShopCashSummary | null) => Boolean(summary?.initializedAt);

export const applyInitializationToSummary = (
  summary: ShopCashSummary | null,
  shopId: ShopId,
  openingBalance: number,
  initializedBy: string
): ShopCashSummary => {
  const current = summary || createEmptyShopSummary(shopId);
  const updatedAt = new Date().toISOString();
  return {
    ...current,
    availableBalance: current.availableBalance + openingBalance,
    openingBalance,
    initializedAt: updatedAt,
    initializedBy,
    updatedAt
  };
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
  totalTransferredOut: 0,
  openingBalance: 0
});
