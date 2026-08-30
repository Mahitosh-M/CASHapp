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

export const isWholeRupeeInput = (value: string) => /^\d*$/.test(value);

export const isValidMoneyAmount = (amount: number) => {
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_MONEY_AMOUNT) return false;
  return Number.isInteger(amount);
};

export const isValidOpeningBalance = (amount: number) => {
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_MONEY_AMOUNT) return false;
  return Number.isInteger(amount);
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
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
}).format(Math.round(amount));

const toWholeRupees = (amount: number) => Math.round(amount);

export const createCashBalanceSnapshot = (summary: ShopCashSummary): CashBalanceSnapshot => ({
  availableBalance: toWholeRupees(summary.availableBalance),
  totalCollections: toWholeRupees(summary.totalCollections),
  totalExpenses: toWholeRupees(summary.totalExpenses),
  totalTransferredIn: toWholeRupees(summary.totalTransferredIn),
  totalTransferredOut: toWholeRupees(summary.totalTransferredOut),
  openingBalance: toWholeRupees(summary.openingBalance)
});

export const detectCashMovement = (
  previous: CashBalanceSnapshot,
  current: CashBalanceSnapshot
): CashMovement | null => {
  const balanceChange = current.availableBalance - previous.availableBalance;
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

export const applyExpenseEditToSummary = (
  summary: ShopCashSummary,
  previousAmount: number,
  nextAmount: number
): ShopCashSummary => {
  const difference = nextAmount - previousAmount;
  return {
    ...summary,
    availableBalance: summary.availableBalance - difference,
    totalExpenses: summary.totalExpenses + difference,
    updatedAt: new Date().toISOString()
  };
};

export const applyExpenseDeletionToSummary = (
  summary: ShopCashSummary,
  amount: number
): ShopCashSummary => ({
  ...summary,
  availableBalance: summary.availableBalance + amount,
  totalExpenses: summary.totalExpenses - amount,
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

export const applyTransferDeletionToSummary = (
  summary: ShopCashSummary,
  amount: number
): ShopCashSummary => ({
  ...summary,
  availableBalance: summary.availableBalance + amount,
  totalTransferredOut: summary.totalTransferredOut - amount,
  updatedAt: new Date().toISOString()
});

const getCashAdjustmentDelta = (amount: number, direction: CashAdjustmentDirection) => (
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

const historyTime = (item: CashHistoryItem) => {
  if (!item.createdAt) return 0;
  if (typeof item.createdAt === 'string') {
    const milliseconds = Date.parse(item.createdAt);
    return Number.isNaN(milliseconds) ? 0 : milliseconds;
  }
  return item.createdAt.toMillis();
};

export const sortCashHistory = (groups: CashHistoryItem[][]) => groups
  .flat()
  .sort((left, right) => historyTime(right) - historyTime(left));

export const createEmptyShopSummary = (shopId: ShopId): ShopCashSummary => ({
  shopId,
  availableBalance: 0,
  totalCollections: 0,
  totalExpenses: 0,
  totalTransferredIn: 0,
  totalTransferredOut: 0,
  openingBalance: 0
});
