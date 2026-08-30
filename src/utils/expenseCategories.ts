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
  { id: 'supplies', label: 'Office supplies' },
  { id: 'taxes', label: 'Taxes & fees' },
  { id: 'other', label: 'Other' }
];

export const isExpenseCategory = (value: unknown): value is ExpenseCategory => (
  typeof value === 'string' && EXPENSE_CATEGORIES.some((category) => category.id === value)
);

export const normalizeExpenseCategory = (value: unknown): ExpenseCategory => (
  value === 'maintenance' ? 'transport' : isExpenseCategory(value) ? value : 'other'
);

export const getExpenseCategoryLabel = (category: ExpenseCategory) => (
  EXPENSE_CATEGORIES.find((option) => option.id === category)?.label ?? 'Other'
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
