import { describe, expect, it } from 'vitest';
import type { CashHistoryItem } from '../types';
import { buildCashAccountingReport } from './accounting';

const row = (id: string, kind: CashHistoryItem['kind'], amount: number, expenseCategory?: CashHistoryItem['expenseCategory']): CashHistoryItem => ({
  id,
  kind,
  amount,
  expenseCategory,
  title: id
});

describe('cash accounting reports', () => {
  it('builds cash P&L and groups categorized expenses', () => {
    const report = buildCashAccountingReport(
      [row('collection-1', 'collection', 20_000), row('collection-2', 'collection', 5_000)],
      [row('salary-1', 'expense', 8_000, 'salary'), row('transport-1', 'expense', 2_000, 'transport')],
      12_500
    );

    expect(report.collections).toBe(25_000);
    expect(report.expenses).toBe(10_000);
    expect(report.netCashResult).toBe(15_000);
    expect(report.expenseCategories.find((item) => item.category === 'salary')).toMatchObject({ amount: 8_000, count: 1 });
    expect(report.expenseCategories.find((item) => item.category === 'transport')).toMatchObject({ amount: 2_000, count: 1 });
    expect(report.cashAsset).toBe(12_500);
    expect(report.cashDeficit).toBe(0);
  });

  it('keeps legacy expenses under Other and represents a negative cash balance as a deficit', () => {
    const report = buildCashAccountingReport([], [row('legacy', 'expense', 750)], -2_500);

    expect(report.expenseCategories.find((item) => item.category === 'other')).toMatchObject({ amount: 750, count: 1 });
    expect(report.cashAsset).toBe(0);
    expect(report.cashDeficit).toBe(2_500);
    expect(report.netCashPosition).toBe(-2_500);
  });
});
