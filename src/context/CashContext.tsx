import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getFriendlyCashError, getRecentCashHistory, getShopCash } from '../services/cashService';
import type { CashAdjustmentDirection, CashHistoryItem, ShopCashSummary } from '../types';
import {
  applyAdjustmentToSummary,
  applyExpenseToSummary,
  applyInitializationToSummary,
  applyTransferToSummary
} from '../utils/cash';

const SUMMARY_RESUME_COOLDOWN_MS = 30_000;

interface CashContextValue {
  summary: ShopCashSummary | null;
  summaryLoading: boolean;
  summaryError: string;
  refreshSummary: () => Promise<void>;
  applyInitializationLocally: (openingBalance: number, initializedBy: string) => void;
  applyExpenseLocally: (amount: number) => void;
  applyTransferLocally: (amount: number) => void;
  applyAdjustmentLocally: (amount: number, direction: CashAdjustmentDirection) => void;
  history: CashHistoryItem[];
  historyLoading: boolean;
  historyError: string;
  loadHistory: (force?: boolean) => Promise<void>;
}

const CashContext = createContext<CashContextValue | undefined>(undefined);

export const CashProvider = ({ children }: { children: ReactNode }) => {
  const { currentShopId, firebaseUser } = useAuth();
  const [summary, setSummary] = useState<ShopCashSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const [history, setHistory] = useState<CashHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyLoadedFor, setHistoryLoadedFor] = useState<string | null>(null);
  const summaryRequestId = useRef(0);
  const historyRequestId = useRef(0);
  const lastSummaryReadAt = useRef(0);

  const refreshSummary = useCallback(async () => {
    if (!currentShopId) return;
    lastSummaryReadAt.current = Date.now();
    const activeRequest = ++summaryRequestId.current;
    setSummaryLoading(true);
    setSummaryError('');

    try {
      const nextSummary = await getShopCash(currentShopId);
      if (activeRequest !== summaryRequestId.current) return;
      setSummary(nextSummary);
    } catch (error) {
      if (activeRequest !== summaryRequestId.current) return;
      setSummary(null);
      setSummaryError(getFriendlyCashError(error, 'load'));
    } finally {
      if (activeRequest === summaryRequestId.current) setSummaryLoading(false);
    }
  }, [currentShopId]);

  useEffect(() => {
    ++summaryRequestId.current;
    ++historyRequestId.current;
    setSummary(null);
    setSummaryError('');
    setHistory([]);
    setHistoryError('');
    setHistoryLoading(false);
    setHistoryLoadedFor(null);

    if (!currentShopId || !firebaseUser) {
      setSummaryLoading(false);
      return;
    }
    void refreshSummary();
  }, [currentShopId, firebaseUser, refreshSummary]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (
        document.visibilityState !== 'visible'
        || !currentShopId
        || !firebaseUser
        || Date.now() - lastSummaryReadAt.current < SUMMARY_RESUME_COOLDOWN_MS
      ) return;

      void refreshSummary();
    };

    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => document.removeEventListener('visibilitychange', refreshWhenVisible);
  }, [currentShopId, firebaseUser, refreshSummary]);

  const invalidateHistory = () => {
    setHistoryLoadedFor(null);
    setHistory([]);
    setHistoryError('');
  };

  const applyExpenseLocally = (amount: number) => {
    setSummary((current) => current ? applyExpenseToSummary(current, amount) : current);
    invalidateHistory();
  };

  const applyInitializationLocally = (openingBalance: number, initializedBy: string) => {
    if (!currentShopId) return;
    setSummary((current) => applyInitializationToSummary(current, currentShopId, openingBalance, initializedBy));
  };

  const applyTransferLocally = (amount: number) => {
    setSummary((current) => current ? applyTransferToSummary(current, amount, 'out') : current);
    invalidateHistory();
  };

  const applyAdjustmentLocally = (amount: number, direction: CashAdjustmentDirection) => {
    setSummary((current) => current ? applyAdjustmentToSummary(current, amount, direction) : current);
    invalidateHistory();
  };

  const loadHistory = useCallback(async (force = false) => {
    if (!currentShopId || (!force && historyLoadedFor === currentShopId)) return;
    const activeRequest = ++historyRequestId.current;
    setHistoryLoading(true);
    setHistoryError('');

    try {
      const rows = await getRecentCashHistory(currentShopId);
      if (activeRequest !== historyRequestId.current) return;
      setHistory(rows);
      setHistoryLoadedFor(currentShopId);
    } catch (error) {
      if (activeRequest !== historyRequestId.current) return;
      setHistoryError(getFriendlyCashError(error, 'history'));
    } finally {
      if (activeRequest === historyRequestId.current) setHistoryLoading(false);
    }
  }, [currentShopId, historyLoadedFor]);

  const value = useMemo<CashContextValue>(() => ({
    summary,
    summaryLoading,
    summaryError,
    refreshSummary,
    applyInitializationLocally,
    applyExpenseLocally,
    applyTransferLocally,
    applyAdjustmentLocally,
    history,
    historyLoading,
    historyError,
    loadHistory
  }), [currentShopId, history, historyError, historyLoading, loadHistory, refreshSummary, summary, summaryError, summaryLoading]);

  return <CashContext.Provider value={value}>{children}</CashContext.Provider>;
};

export const useCash = () => {
  const context = useContext(CashContext);
  if (!context) throw new Error('useCash must be used inside CashProvider.');
  return context;
};
