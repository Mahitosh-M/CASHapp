import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import type { CashHistoryItem, ShopCashSummary } from '../types';
import {
  MAX_MONEY_AMOUNT,
  applyAdjustmentToSummary,
  applyExpenseToSummary,
  applyInitializationToSummary,
  applyTransferToSummary,
  createCashBalanceSnapshot,
  detectCashMovement,
  formatMoney,
  isWholeRupeeInput,
  isValidMoneyAmount,
  isValidOpeningBalance,
  isShopCashInitialized,
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
  totalTransferredOut: 1_000,
  openingBalance: 0
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
    expect(parseMoneyInput(' 1250 ')).toBe(1250);
    expect(Number.isNaN(parseMoneyInput(''))).toBe(true);
  });

  it('accepts positive whole rupees and rejects fractional values', () => {
    expect(isValidMoneyAmount(1)).toBe(true);
    expect(isValidMoneyAmount(10.25)).toBe(false);
    expect(isValidMoneyAmount(10.256)).toBe(false);
  });

  it('rejects zero, negative, non-finite, and unreasonable values', () => {
    expect(isValidMoneyAmount(0)).toBe(false);
    expect(isValidMoneyAmount(-5)).toBe(false);
    expect(isValidMoneyAmount(Number.NaN)).toBe(false);
    expect(isValidMoneyAmount(MAX_MONEY_AMOUNT + 1)).toBe(false);
  });

  it('allows zero only for the one-time opening balance', () => {
    expect(isValidOpeningBalance(0)).toBe(true);
    expect(isValidOpeningBalance(500.25)).toBe(false);
    expect(isValidOpeningBalance(-1)).toBe(false);
    expect(isValidOpeningBalance(1.001)).toBe(false);
  });

  it('allows only digits in whole-rupee input fields', () => {
    expect(isWholeRupeeInput('')).toBe(true);
    expect(isWholeRupeeInput('1250')).toBe(true);
    expect(isWholeRupeeInput('12.50')).toBe(false);
    expect(isWholeRupeeInput('-10')).toBe(false);
  });

  it('formats balances and movement snapshots as whole rupees', () => {
    expect(formatMoney(1_250.75)).toContain('1,251');
    expect(formatMoney(1_250.75)).not.toContain('.');
    expect(createCashBalanceSnapshot({ ...summary, availableBalance: 10_000.6 }).availableBalance).toBe(10_001);
  });

  it('requires a trimmed expense explanation', () => {
    expect(validateDescription('   ')).toContain('reason');
    expect(validateDescription('Fuel')).toBeNull();
    expect(validateDescription('x'.repeat(161))).toContain('160');
  });
});

describe('local summary updates', () => {
  it('initializes an empty summary or adds opening cash to an existing CRM summary', () => {
    const empty = applyInitializationToSummary(null, 'SHOP_A', 500, 'admin-1');
    const existing = applyInitializationToSummary(summary, 'SHOP_A', 500, 'admin-1');

    expect(empty.availableBalance).toBe(500);
    expect(empty.totalCollections).toBe(0);
    expect(existing.availableBalance).toBe(10_500);
    expect(existing.totalCollections).toBe(20_000);
    expect(existing.openingBalance).toBe(500);
    expect(isShopCashInitialized(existing)).toBe(true);
  });

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

  it('applies Admin adjustments without changing collection or activity totals', () => {
    const added = applyAdjustmentToSummary(summary, 1_250, 'add');
    const deducted = applyAdjustmentToSummary(summary, 750, 'deduct');

    expect(added.availableBalance).toBe(11_250);
    expect(deducted.availableBalance).toBe(9_250);
    expect(added.totalCollections).toBe(summary.totalCollections);
    expect(deducted.totalExpenses).toBe(summary.totalExpenses);
  });
});

describe('cash movement detection', () => {
  it('recognizes incoming CRM collections', () => {
    const previous = createCashBalanceSnapshot(summary);
    const current = createCashBalanceSnapshot({
      ...summary,
      availableBalance: 11_500,
      totalCollections: 21_500
    });

    expect(detectCashMovement(previous, current)).toEqual({
      direction: 'in',
      kind: 'collection',
      amount: 1_500,
      balance: 11_500
    });
  });

  it('recognizes expense reductions', () => {
    const previous = createCashBalanceSnapshot(summary);
    const current = createCashBalanceSnapshot(applyExpenseToSummary(summary, 750));

    expect(detectCashMovement(previous, current)).toMatchObject({
      direction: 'out',
      kind: 'expense',
      amount: 750
    });
  });

  it('recognizes incoming and outgoing transfers', () => {
    const previous = createCashBalanceSnapshot(summary);
    const incoming = createCashBalanceSnapshot(applyTransferToSummary(summary, 2_000, 'in'));
    const outgoing = createCashBalanceSnapshot(applyTransferToSummary(summary, 2_000, 'out'));

    expect(detectCashMovement(previous, incoming)).toMatchObject({ direction: 'in', kind: 'transfer-in', amount: 2_000 });
    expect(detectCashMovement(previous, outgoing)).toMatchObject({ direction: 'out', kind: 'transfer-out', amount: 2_000 });
  });

  it('does not create a popup when the available amount is unchanged', () => {
    const snapshot = createCashBalanceSnapshot(summary);
    expect(detectCashMovement(snapshot, snapshot)).toBeNull();
  });

  it('recognizes Admin additions and deductions as adjustments', () => {
    const previous = createCashBalanceSnapshot(summary);
    const added = createCashBalanceSnapshot(applyAdjustmentToSummary(summary, 500, 'add'));
    const deducted = createCashBalanceSnapshot(applyAdjustmentToSummary(summary, 500, 'deduct'));

    expect(detectCashMovement(previous, added)).toMatchObject({ direction: 'in', kind: 'adjustment', amount: 500 });
    expect(detectCashMovement(previous, deducted)).toMatchObject({ direction: 'out', kind: 'adjustment', amount: 500 });
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
    expect(getShopName('SHOP_A')).toBe('ASHOKA');
    expect(getShopName('SHOP_S')).toBe('SMPA');
  });
});
