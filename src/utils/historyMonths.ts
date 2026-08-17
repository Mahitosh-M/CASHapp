export interface HistoryMonth {
  year: number;
  month: number;
}

const compareHistoryMonths = (left: HistoryMonth, right: HistoryMonth) => (
  left.year * 12 + left.month - (right.year * 12 + right.month)
);

export const getHistoryMonth = (date: Date): HistoryMonth => ({
  year: date.getFullYear(),
  month: date.getMonth()
});

export const getHistoryMonthKey = ({ year, month }: HistoryMonth) => (
  `${year}-${String(month + 1).padStart(2, '0')}`
);

export const getHistoryMonthLabel = ({ year, month }: HistoryMonth) => (
  new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' })
    .format(new Date(year, month, 1))
    .toUpperCase()
);

export const getHistoryMonthBounds = ({ year, month }: HistoryMonth) => ({
  start: new Date(year, month, 1),
  end: new Date(year, month + 1, 1)
});

export const getDistinctPreviousHistoryMonths = (
  current: HistoryMonth,
  activityDates: Date[]
): HistoryMonth[] => {
  const months = new Map<string, HistoryMonth>();
  activityDates.forEach((date) => {
    if (Number.isNaN(date.getTime())) return;
    const month = getHistoryMonth(date);
    if (compareHistoryMonths(month, current) >= 0) return;
    months.set(getHistoryMonthKey(month), month);
  });
  return [...months.values()].sort((left, right) => compareHistoryMonths(right, left));
};
