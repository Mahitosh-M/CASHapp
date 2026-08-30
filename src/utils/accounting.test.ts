import { describe, expect, it } from 'vitest';
import type { CashHistoryItem } from '../types';
import { buildCashAccountingReport, buildCashFlowAllocations } from './accounting';

const row = (id: string, kind: CashHistoryItem['kind'], amount: number, expenseCategory?: CashHistoryItem['expenseCategory']): CashHistoryItem => ({
  id,
  kind,
  amount,
  expenseCategory,
  title: id
});

describe('cash accounting reports', () => {
  it('builds cash P&L and groups categorized expenses', () => {
    const report = buildCashAccountingReport([
      row('collection-1', 'collection', 20_000),
      row('collection-2', 'collection', 5_000),
        row('purchase-1', 'expense', 9_000, 'purchases'),
        row('emi-1', 'expense', 3_000, 'emi'),
        row('salary-1', 'expense', 8_000, 'salary'),
        row('transport-1', 'expense', 2_000, 'transport')
    ]);

    expect(report.collections).toBe(25_000);
    expect(report.purchases).toBe(9_000);
    expect(report.emiPayments).toBe(3_000);
    expect(report.grossProfit).toBe(16_000);
    expect(report.operatingExpenses).toBe(10_000);
    expect(report.netCashResult).toBe(6_000);
    expect(report.expenseCategories.some((item) => item.category === 'purchases')).toBe(false);
    expect(report.expenseCategories.some((item) => item.category === 'emi')).toBe(false);
    expect(report.expenseCategories.find((item) => item.category === 'salary')).toMatchObject({ amount: 8_000 });
    expect(report.expenseCategories.find((item) => item.category === 'transport')).toMatchObject({ amount: 2_000 });
  });

  it('keeps legacy expenses under Other', () => {
    const report = buildCashAccountingReport([row('legacy', 'expense', 750)]);

    expect(report.purchases).toBe(0);
    expect(report.emiPayments).toBe(0);
    expect(report.grossProfit).toBe(0);
    expect(report.operatingExpenses).toBe(750);
    expect(report.expenseCategories.find((item) => item.category === 'other')).toMatchObject({ amount: 750 });
  });

  it('builds cash flow totals and can eliminate internal transfers from a combined report', () => {
    const history = [
      row('collection', 'collection', 10_000),
      row('purchase', 'expense', 3_000, 'purchases'),
      row('emi', 'expense', 2_000, 'emi'),
      row('salary', 'expense', 1_000, 'salary'),
      row('transfer-in', 'transfer-in', 5_000),
      row('transfer-out', 'transfer-out', 2_000),
      row('adjustment-in', 'adjustment-in', 500),
      row('adjustment-out', 'adjustment-out', 250)
    ];
    const shopReport = buildCashAccountingReport(history);
    expect(shopReport.cashInflows).toBe(15_500);
    expect(shopReport.cashOutflows).toBe(8_250);
    expect(shopReport.netCashFlow).toBe(7_250);
    const allocations = buildCashFlowAllocations(shopReport);
    expect(allocations.reduce((total, allocation) => total + allocation.amount, 0)).toBe(shopReport.cashOutflows);
    expect(allocations.find((allocation) => allocation.key === 'emi')).toMatchObject({
      amount: 2_000,
      shareOfOutflows: 24,
      shareOfCollections: 20
    });
    expect(allocations.find((allocation) => allocation.key === 'salary')).toMatchObject({ amount: 1_000 });

    const combinedReport = buildCashAccountingReport(history, { excludeTransfers: true });
    expect(combinedReport.cashInflows).toBe(10_500);
    expect(combinedReport.cashOutflows).toBe(6_250);
    expect(combinedReport.netCashFlow).toBe(4_250);
    expect(buildCashFlowAllocations(combinedReport).find((allocation) => allocation.key === 'emi')).toMatchObject({
      shareOfOutflows: 32
    });
  });
});
