import type { CashHistoryItem, ExpenseCategory } from '../types';
import { EXPENSE_CATEGORIES, normalizeExpenseCategory } from './expenseCategories';

export interface ExpenseCategoryTotal {
  category: ExpenseCategory;
  label: string;
  amount: number;
}

export interface CashAccountingReport {
  collections: number;
  purchases: number;
  emiPayments: number;
  grossProfit: number;
  operatingExpenses: number;
  netCashResult: number;
  transfersIn: number;
  transfersOut: number;
  adjustmentsIn: number;
  adjustmentsOut: number;
  cashInflows: number;
  cashOutflows: number;
  netCashFlow: number;
  expenseCategories: ExpenseCategoryTotal[];
}

export interface CashFlowAllocation {
  key: string;
  label: string;
  amount: number;
  shareOfOutflows: number;
  shareOfCollections: number;
}

const sumAmounts = (items: CashHistoryItem[]) => (
  items.reduce((total, item) => total + Math.max(0, item.amount), 0)
);

const sumKind = (items: CashHistoryItem[], kind: CashHistoryItem['kind']) => (
  sumAmounts(items.filter((item) => item.kind === kind))
);

interface CashAccountingOptions {
  excludeTransfers?: boolean;
}

export const buildCashAccountingReport = (
  cashFlowItems: CashHistoryItem[],
  options: CashAccountingOptions = {}
): CashAccountingReport => {
  const collections = cashFlowItems.filter((item) => item.kind === 'collection');
  const expenses = cashFlowItems.filter((item) => item.kind === 'expense');
  const expenseTotals = new Map<ExpenseCategory, number>();

  expenses.forEach((expense) => {
    const category = normalizeExpenseCategory(expense.expenseCategory);
    if (category === 'purchases' || category === 'emi') return;
    expenseTotals.set(category, (expenseTotals.get(category) ?? 0) + Math.max(0, expense.amount));
  });

  const collectionTotal = sumAmounts(collections);
  const purchases = expenses.filter((expense) => normalizeExpenseCategory(expense.expenseCategory) === 'purchases');
  const emiPayments = expenses.filter((expense) => normalizeExpenseCategory(expense.expenseCategory) === 'emi');
  const purchaseTotal = sumAmounts(purchases);
  const emiTotal = sumAmounts(emiPayments);
  const operatingExpenseTotal = sumAmounts(
    expenses.filter((expense) => {
      const category = normalizeExpenseCategory(expense.expenseCategory);
      return category !== 'purchases' && category !== 'emi';
    })
  );
  const grossProfit = collectionTotal - purchaseTotal;
  const transfersIn = options.excludeTransfers ? 0 : sumKind(cashFlowItems, 'transfer-in');
  const transfersOut = options.excludeTransfers ? 0 : sumKind(cashFlowItems, 'transfer-out');
  const adjustmentsIn = sumKind(cashFlowItems, 'adjustment-in');
  const adjustmentsOut = sumKind(cashFlowItems, 'adjustment-out');
  const cashInflows = collectionTotal + transfersIn + adjustmentsIn;
  const cashOutflows = purchaseTotal + emiTotal + operatingExpenseTotal + transfersOut + adjustmentsOut;

  return {
    collections: collectionTotal,
    purchases: purchaseTotal,
    emiPayments: emiTotal,
    grossProfit,
    operatingExpenses: operatingExpenseTotal,
    netCashResult: grossProfit - operatingExpenseTotal,
    transfersIn,
    transfersOut,
    adjustmentsIn,
    adjustmentsOut,
    cashInflows,
    cashOutflows,
    netCashFlow: cashInflows - cashOutflows,
    expenseCategories: EXPENSE_CATEGORIES.map((category) => ({
      category: category.id,
      label: category.label,
      amount: expenseTotals.get(category.id) ?? 0
    }))
  };
};

export const buildCashFlowAllocations = (report: CashAccountingReport): CashFlowAllocation[] => {
  const allocations = [
    { key: 'purchases', label: 'Purchases (COGS)', amount: report.purchases },
    { key: 'emi', label: 'EMI Payments', amount: report.emiPayments },
    ...report.expenseCategories.map((category) => ({
      key: category.category,
      label: category.label,
      amount: category.amount
    })),
    { key: 'transfers-out', label: 'Transfers Out', amount: report.transfersOut },
    { key: 'adjustments-out', label: 'Admin Deductions', amount: report.adjustmentsOut }
  ].filter((allocation) => allocation.amount > 0);

  return allocations.map((allocation) => ({
    ...allocation,
    shareOfOutflows: report.cashOutflows > 0
      ? Math.round((allocation.amount / report.cashOutflows) * 100)
      : 0,
    shareOfCollections: report.collections > 0
      ? Math.round((allocation.amount / report.collections) * 100)
      : 0
  }));
};
