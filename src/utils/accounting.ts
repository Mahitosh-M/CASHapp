import type { CashHistoryItem, ExpenseCategory } from '../types';
import { EXPENSE_CATEGORIES, normalizeExpenseCategory } from './expenseCategories';

export interface ExpenseCategoryTotal {
  category: ExpenseCategory;
  label: string;
  amount: number;
  count: number;
}

export interface CashAccountingReport {
  collections: number;
  expenses: number;
  netCashResult: number;
  cashAsset: number;
  cashDeficit: number;
  netCashPosition: number;
  expenseCategories: ExpenseCategoryTotal[];
}

const sumAmounts = (items: CashHistoryItem[]) => (
  items.reduce((total, item) => total + Math.max(0, item.amount), 0)
);

export const buildCashAccountingReport = (
  collections: CashHistoryItem[],
  expenses: CashHistoryItem[],
  availableBalance: number
): CashAccountingReport => {
  const expenseTotals = new Map<ExpenseCategory, { amount: number; count: number }>();

  expenses.forEach((expense) => {
    const category = normalizeExpenseCategory(expense.expenseCategory);
    const current = expenseTotals.get(category) ?? { amount: 0, count: 0 };
    current.amount += Math.max(0, expense.amount);
    current.count += 1;
    expenseTotals.set(category, current);
  });

  const collectionTotal = sumAmounts(collections);
  const expenseTotal = sumAmounts(expenses);
  const netCashPosition = Number.isFinite(availableBalance) ? availableBalance : 0;

  return {
    collections: collectionTotal,
    expenses: expenseTotal,
    netCashResult: collectionTotal - expenseTotal,
    cashAsset: Math.max(0, netCashPosition),
    cashDeficit: Math.max(0, -netCashPosition),
    netCashPosition,
    expenseCategories: EXPENSE_CATEGORIES.map((category) => ({
      category: category.id,
      label: category.label,
      amount: expenseTotals.get(category.id)?.amount ?? 0,
      count: expenseTotals.get(category.id)?.count ?? 0
    }))
  };
};
