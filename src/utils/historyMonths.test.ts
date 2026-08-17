import { describe, expect, it } from 'vitest';
import {
  getHistoryMonthBounds,
  getHistoryMonthKey,
  getHistoryMonthLabel,
  getDistinctPreviousHistoryMonths
} from './historyMonths';

describe('monthly cash history', () => {
  it('lists only distinct previous months that contain activity', () => {
    expect(getDistinctPreviousHistoryMonths(
      { year: 2026, month: 7 },
      [
        new Date(2026, 6, 20),
        new Date(2026, 6, 1),
        new Date(2026, 4, 12),
        new Date(2026, 7, 4)
      ]
    )).toEqual([
      { year: 2026, month: 6 },
      { year: 2026, month: 4 }
    ]);
  });

  it('handles a year boundary and stable month labels', () => {
    expect(getDistinctPreviousHistoryMonths(
      { year: 2027, month: 0 },
      [new Date(2026, 10, 20), new Date(2026, 11, 2)]
    )).toEqual([
      { year: 2026, month: 11 },
      { year: 2026, month: 10 }
    ]);
    expect(getHistoryMonthKey({ year: 2026, month: 7 })).toBe('2026-08');
    expect(getHistoryMonthLabel({ year: 2026, month: 7 })).toBe('AUGUST 2026');
  });

  it('builds exact local calendar month boundaries', () => {
    const bounds = getHistoryMonthBounds({ year: 2026, month: 11 });
    expect(bounds.start.getFullYear()).toBe(2026);
    expect(bounds.start.getMonth()).toBe(11);
    expect(bounds.start.getDate()).toBe(1);
    expect(bounds.end.getFullYear()).toBe(2027);
    expect(bounds.end.getMonth()).toBe(0);
    expect(bounds.end.getDate()).toBe(1);
  });
});
