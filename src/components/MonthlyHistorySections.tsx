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
import { jsPDF } from 'jspdf';

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
  onEditExpense?: (expenseId: string) => void;
  shopName?: string;
  showPdfButtons?: boolean;
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
  onEditTransfer,
  onEditExpense
  ,shopName = 'SHOP', showPdfButtons = true
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
  const downloadPdf = (month: HistoryMonth, items: CashHistoryItem[]) => {
    const pdf = new jsPDF(); const label = getHistoryMonthLabel(month); let y = 24; let balance = 0;
    pdf.setFillColor(30, 64, 175); pdf.rect(0, 0, 210, 20, 'F'); pdf.setTextColor(255, 255, 255); pdf.setFontSize(18); pdf.text(`${shopName} CASH HISTORY`, 14, 13);
    pdf.setTextColor(50, 50, 80); pdf.setFontSize(11); pdf.text(label, 14, 28); pdf.setFillColor(238, 242, 255); pdf.rect(14, 33, 182, 9, 'F'); pdf.setFontSize(10); pdf.text('DATE / DETAILS', 16, 39); pdf.text('INCOMING', 105, 39); pdf.text('OUTGOING', 137, 39); pdf.text('BALANCE', 170, 39); y = 49;
    const rows = [...items].reverse().map((item) => { const incoming = item.kind === 'collection' || item.kind === 'transfer-in' || item.kind === 'adjustment-in'; balance += incoming ? item.amount : -item.amount; return { item, incoming, balance }; }).reverse();
    rows.forEach(({ item, incoming, balance: rowBalance }) => { pdf.setTextColor(45,45,60); pdf.text(`${item.title}`.slice(0, 42), 16, y); pdf.setTextColor(22, 130, 70); if (incoming) pdf.text(`Rs ${item.amount.toFixed(2)}`, 105, y); else pdf.text('-', 105, y); pdf.setTextColor(185, 28, 28); if (!incoming) pdf.text(`Rs ${item.amount.toFixed(2)}`, 137, y); else pdf.text('-', 137, y); pdf.setTextColor(rowBalance >= 0 ? 22 : 185, rowBalance >= 0 ? 130 : 28, rowBalance >= 0 ? 70 : 28); pdf.text(`Rs ${rowBalance.toFixed(2)}`, 170, y); y += 8; if (y > 280) { pdf.addPage(); y = 20; } });
    pdf.save(`${shopName}-${getHistoryMonthKey(month)}-history.pdf`);
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
        {showPdfButtons ? <button className="secondary" type="button" onClick={() => downloadPdf(currentMonth, currentItems)}>Download PDF</button> : null}
        {currentItems.length > 0
          ? <CashHistoryList items={currentItems} onEditTransfer={onEditTransfer} onEditExpense={onEditExpense} />
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
                  {showPdfButtons && monthState.loaded && monthState.items.length > 0 ? <button className="secondary" type="button" onClick={() => downloadPdf(month, monthState.items)}>Download PDF</button> : null}
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
                    ? <CashHistoryList items={monthState.items} onEditTransfer={onEditTransfer} onEditExpense={onEditExpense} />
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
