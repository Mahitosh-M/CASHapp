import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import type { CashHistoryItem, ShopCashSummary } from '../types';
import {
  MAX_MONEY_AMOUNT,
  applyExpenseToSummary,
  applyTransferToSummary,
  isValidMoneyAmount,
  mergeRecentHistory,
  parseMoneyInput,
  validateDescription
} from './cash';
import { getOtherShopId, getShopName, isShopId } from './shops';

const summary: ShopCashSummary = {
  shopId: 'SHOP_A',
  availableBalance: 10_000,
  totalCollections: 20_000,
  totalExpenses: 2_000,
  totalTransferredIn: 500,
  totalTransferredOut: 1_000
};

const historyItem = (id: string, milliseconds: number): CashHistoryItem => ({
  id,
  kind: 'expense',
  amount: 100,
  title: id,
  createdAt: Timestamp.fromMillis(milliseconds)
});

describe('cash input validation', () => {
  it('parses normal rupee values and rejects blank input', () => {
    expect(parseMoneyInput(' 1250.50 ')).toBe(1250.5);
    expect(Number.isNaN(parseMoneyInput(''))).toBe(true);
  });

  it('accepts positive values with at most two decimal places', () => {
    expect(isValidMoneyAmount(1)).toBe(true);
    expect(isValidMoneyAmount(10.25)).toBe(true);
    expect(isValidMoneyAmount(10.256)).toBe(false);
  });

  it('rejects zero, negative, non-finite, and unreasonable values', () => {
    expect(isValidMoneyAmount(0)).toBe(false);
    expect(isValidMoneyAmount(-5)).toBe(false);
    expect(isValidMoneyAmount(Number.NaN)).toBe(false);
    expect(isValidMoneyAmount(MAX_MONEY_AMOUNT + 1)).toBe(false);
  });

  it('requires a trimmed expense explanation', () => {
    expect(validateDescription('   ')).toContain('reason');
    expect(validateDescription('Fuel')).toBeNull();
    expect(validateDescription('x'.repeat(161))).toContain('160');
  });
});

describe('local summary updates', () => {
  it('applies an expense without changing CRM collection totals', () => {
    const next = applyExpenseToSummary(summary, 750);
    expect(next.availableBalance).toBe(9_250);
    expect(next.totalExpenses).toBe(2_750);
    expect(next.totalCollections).toBe(20_000);
  });

  it('applies outgoing and incoming transfers without changing collections', () => {
    const outgoing = applyTransferToSummary(summary, 2_000, 'out');
    const incoming = applyTransferToSummary(summary, 2_000, 'in');
    expect(outgoing.availableBalance).toBe(8_000);
    expect(outgoing.totalTransferredOut).toBe(3_000);
    expect(incoming.availableBalance).toBe(12_000);
    expect(incoming.totalTransferredIn).toBe(2_500);
    expect(outgoing.totalCollections).toBe(20_000);
    expect(incoming.totalCollections).toBe(20_000);
  });
});

describe('bounded history and shops', () => {
  it('merges activity by newest timestamp and respects the display limit', () => {
    const rows = mergeRecentHistory([
      [historyItem('old', 1_000), historyItem('new', 4_000)],
      [historyItem('middle', 2_000)]
    ], 2);
    expect(rows.map((row) => row.id)).toEqual(['new', 'middle']);
  });

  it('uses the fixed two-shop relationship', () => {
    expect(isShopId('SHOP_A')).toBe(true);
    expect(isShopId('SHOP_X')).toBe(false);
    expect(getOtherShopId('SHOP_A')).toBe('SHOP_S');
    expect(getOtherShopId('SHOP_S')).toBe('SHOP_A');
    expect(getShopName('SHOP_S')).toBe('Shop S');
  });
});
