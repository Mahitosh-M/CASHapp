import { describe, expect, it } from 'vitest';
import {
  getExpenseDescriptionForCategory,
  normalizeExpenseCategory,
  resolveExpenseDetails
} from './expenseCategories';

describe('expense categories', () => {
  it('uses the selected tile as the default explanation', () => {
    expect(getExpenseDescriptionForCategory('', '', 'fuel')).toBe('Fuel');
    expect(getExpenseDescriptionForCategory('Fuel', 'fuel', 'electricity')).toBe('Electricity');
  });

  it('preserves a custom explanation when the category changes', () => {
    expect(getExpenseDescriptionForCategory('Fuel for generator', 'fuel', 'electricity')).toBe('Fuel for generator');
  });

  it('defaults an expense without a selected tile to Other', () => {
    expect(resolveExpenseDetails('', '')).toEqual({ category: 'other', description: 'Other' });
    expect(resolveExpenseDetails('', 'Staff refreshments')).toEqual({
      category: 'other',
      description: 'Staff refreshments'
    });
  });

  it('uses the selected category when the explanation is blank', () => {
    expect(resolveExpenseDetails('fuel', '')).toEqual({ category: 'fuel', description: 'Fuel' });
  });

  it('maps the replaced maintenance category to Transport for legacy records', () => {
    expect(normalizeExpenseCategory('maintenance')).toBe('transport');
  });
});
