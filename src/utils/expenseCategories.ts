import type { ExpenseCategory } from '../types';

export interface ExpenseCategoryOption {
  id: ExpenseCategory;
  label: string;
}

export const EXPENSE_CATEGORIES: ExpenseCategoryOption[] = [
  { id: 'salary', label: 'Salary' },
  { id: 'fuel', label: 'Fuel' },
  { id: 'electricity', label: 'Electricity' },
  { id: 'rent', label: 'Rent' },
  { id: 'transport', label: 'Transport (VRL)' },
  { id: 'supplies', label: 'Office Supplies' },
  { id: 'taxes', label: 'Taxes & Fees' },
  { id: 'other', label: 'Other' }
];

const PURCHASE_CATEGORY: ExpenseCategoryOption = { id: 'purchases', label: 'Purchases' };
const EMI_CATEGORY: ExpenseCategoryOption = { id: 'emi', label: 'EMI' };

export const CASH_OUTFLOW_CATEGORIES = [PURCHASE_CATEGORY, EMI_CATEGORY, ...EXPENSE_CATEGORIES];

const isExpenseCategory = (value: unknown): value is ExpenseCategory => (
  typeof value === 'string' && CASH_OUTFLOW_CATEGORIES.some((category) => category.id === value)
);

export const normalizeExpenseCategory = (value: unknown): ExpenseCategory => (
  value === 'maintenance' ? 'transport' : isExpenseCategory(value) ? value : 'other'
);

export const getExpenseCategoryLabel = (category: ExpenseCategory) => (
  CASH_OUTFLOW_CATEGORIES.find((option) => option.id === category)?.label ?? 'Other'
);

export const getExpenseDescriptionForCategory = (
  currentDescription: string,
  currentCategory: ExpenseCategory | '',
  nextCategory: ExpenseCategory
) => {
  const previousCategoryDescription = currentCategory ? getExpenseCategoryLabel(currentCategory) : '';
  return !currentDescription.trim() || currentDescription === previousCategoryDescription
    ? getExpenseCategoryLabel(nextCategory)
    : currentDescription;
};

export const resolveExpenseDetails = (
  category: ExpenseCategory | '',
  description: string
) => {
  const resolvedCategory: ExpenseCategory = category || 'other';
  return {
    category: resolvedCategory,
    description: description.trim() || getExpenseCategoryLabel(resolvedCategory)
  };
};
