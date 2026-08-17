import { ChevronDown, ChevronUp, History } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getFriendlyCashError } from '../services/cashService';
import type { CashHistoryItem } from '../types';
import {
  getHistoryMonth,
  getHistoryMonthBounds,
  getHistoryMonthKey,
  getHistoryMonthLabel,
  getDistinctPreviousHistoryMonths,
  type HistoryMonth
} from '../utils/historyMonths';
import { CashHistoryList } from './CashHistoryList';

interface LoadedMonth {
  items: CashHistoryItem[];
  loading: boolean;
  loaded: boolean;
  error: string;
}

interface MonthlyHistorySectionsProps {
  queryKey: string;
  emptyText: string;
  loadMonth: (start: Date, end: Date) => Promise<CashHistoryItem[]>;
  loadPreviousDates: (before: Date) => Promise<Date[]>;
  onEditTransfer?: (transferId: string) => void;
}

const emptyMonth: LoadedMonth = {
  items: [],
  loading: false,
  loaded: false,
  error: ''
};

export const MonthlyHistorySections = ({
  queryKey,
  emptyText,
  loadMonth,
  loadPreviousDates,
  onEditTransfer
}: MonthlyHistorySectionsProps) => {
  const currentMonth = useMemo(() => getHistoryMonth(new Date()), []);
  const [currentItems, setCurrentItems] = useState<CashHistoryItem[]>([]);
  const [previousMonths, setPreviousMonths] = useState<HistoryMonth[]>([]);
  const [loadedMonths, setLoadedMonths] = useState<Record<string, LoadedMonth>>({});
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);

  useEffect(() => {
    const activeGeneration = ++generation.current;
    const bounds = getHistoryMonthBounds(currentMonth);
    setCurrentItems([]);
    setPreviousMonths([]);
    setLoadedMonths({});
    setExpandedMonths(new Set());
    setLoading(true);
    setError('');

    void Promise.all([
      loadMonth(bounds.start, bounds.end),
      loadPreviousDates(bounds.start)
    ]).then(([items, previousDates]) => {
      if (generation.current !== activeGeneration) return;
      setCurrentItems(items);
      setPreviousMonths(getDistinctPreviousHistoryMonths(currentMonth, previousDates));
    }).catch((loadError) => {
      if (generation.current !== activeGeneration) return;
      setError(getFriendlyCashError(loadError, 'history'));
    }).finally(() => {
      if (generation.current === activeGeneration) setLoading(false);
    });

    return () => {
      generation.current += 1;
    };
  }, [currentMonth, loadMonth, loadPreviousDates, queryKey]);

  const toggleMonth = async (month: HistoryMonth) => {
    const key = getHistoryMonthKey(month);
    const isExpanded = expandedMonths.has(key);
    setExpandedMonths((current) => {
      const next = new Set(current);
      if (isExpanded) next.delete(key);
      else next.add(key);
      return next;
    });
    if (isExpanded || loadedMonths[key]?.loaded || loadedMonths[key]?.loading) return;

    const activeGeneration = generation.current;
    const bounds = getHistoryMonthBounds(month);
    setLoadedMonths((current) => ({
      ...current,
      [key]: { ...emptyMonth, loading: true }
    }));
    try {
      const items = await loadMonth(bounds.start, bounds.end);
      if (generation.current !== activeGeneration) return;
      setLoadedMonths((current) => ({
        ...current,
        [key]: { items, loading: false, loaded: true, error: '' }
      }));
    } catch (loadError) {
      if (generation.current !== activeGeneration) return;
      setLoadedMonths((current) => ({
        ...current,
        [key]: {
          items: [],
          loading: false,
          loaded: false,
          error: getFriendlyCashError(loadError, 'history')
        }
      }));
    }
  };

  if (loading) {
    return (
      <div className="history-loading" role="status">
        <div className="loading-spinner" aria-hidden="true" />
        Loading entries...
      </div>
    );
  }

  if (error) return <div className="notice error" role="alert">{error}</div>;

  if (currentItems.length === 0 && previousMonths.length === 0) {
    return (
      <div className="empty-state">
        <History size={30} />
        <h2>No entries</h2>
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="monthly-history">
      <section className="current-history-month" aria-labelledby="current-history-month">
        <h2 id="current-history-month" className="history-month-title">
          {getHistoryMonthLabel(currentMonth)}
        </h2>
        {currentItems.length > 0
          ? <CashHistoryList items={currentItems} onEditTransfer={onEditTransfer} />
          : <div className="history-month-empty">No entries this month.</div>}
      </section>

      <div className="previous-history-months">
        {previousMonths.map((month) => {
          const key = getHistoryMonthKey(month);
          const expanded = expandedMonths.has(key);
          const monthState = loadedMonths[key] || emptyMonth;
          const contentId = `history-month-${key}`;
          return (
            <section className="previous-history-month" key={key}>
              <button
                className="history-month-toggle"
                type="button"
                aria-expanded={expanded}
                aria-controls={contentId}
                onClick={() => void toggleMonth(month)}
              >
                <span>{getHistoryMonthLabel(month)}</span>
                {expanded ? <ChevronUp size={21} /> : <ChevronDown size={21} />}
              </button>
              {expanded ? (
                <div className="history-month-content" id={contentId}>
                  {monthState.loading ? (
                    <div className="history-month-loading" role="status">
                      <div className="loading-spinner" aria-hidden="true" />
                      Loading entries...
                    </div>
                  ) : null}
                  {monthState.error ? <div className="notice error" role="alert">{monthState.error}</div> : null}
                  {monthState.loaded && monthState.items.length === 0
                    ? <div className="history-month-empty">No entries for this month.</div>
                    : null}
                  {monthState.items.length > 0
                    ? <CashHistoryList items={monthState.items} onEditTransfer={onEditTransfer} />
                    : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
};
