import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getFriendlyCashError, getShopCash } from '../services/cashService';
import type { CashAdjustmentDirection, ShopCashSummary } from '../types';
import {
  applyAdjustmentToSummary,
  applyExpenseToSummary,
  applyInitializationToSummary,
  applyTransferDeletionToSummary,
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
  applyTransferEditLocally: (amountDifference: number) => void;
  applyTransferDeletionLocally: (amount: number) => void;
  applyAdjustmentLocally: (amount: number, direction: CashAdjustmentDirection) => void;
}

const CashContext = createContext<CashContextValue | undefined>(undefined);

export const CashProvider = ({ children }: { children: ReactNode }) => {
  const { currentShopId, firebaseUser } = useAuth();
  const [summary, setSummary] = useState<ShopCashSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const summaryRequestId = useRef(0);
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
    setSummary(null);
    setSummaryError('');

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

  const applyExpenseLocally = (amount: number) => {
    setSummary((current) => current ? applyExpenseToSummary(current, amount) : current);
  };

  const applyInitializationLocally = (openingBalance: number, initializedBy: string) => {
    if (!currentShopId) return;
    setSummary((current) => applyInitializationToSummary(current, currentShopId, openingBalance, initializedBy));
  };

  const applyTransferLocally = (amount: number) => {
    setSummary((current) => current ? applyTransferToSummary(current, amount, 'out') : current);
  };

  const applyTransferEditLocally = (amountDifference: number) => {
    setSummary((current) => current
      ? applyTransferToSummary(current, amountDifference, 'out')
      : current);
  };

  const applyTransferDeletionLocally = (amount: number) => {
    setSummary((current) => current
      ? applyTransferDeletionToSummary(current, amount)
      : current);
  };

  const applyAdjustmentLocally = (amount: number, direction: CashAdjustmentDirection) => {
    setSummary((current) => current ? applyAdjustmentToSummary(current, amount, direction) : current);
  };

  const value = useMemo<CashContextValue>(() => ({
    summary,
    summaryLoading,
    summaryError,
    refreshSummary,
    applyInitializationLocally,
    applyExpenseLocally,
    applyTransferLocally,
    applyTransferEditLocally,
    applyTransferDeletionLocally,
    applyAdjustmentLocally,
  }), [currentShopId, refreshSummary, summary, summaryError, summaryLoading]);

  return <CashContext.Provider value={value}>{children}</CashContext.Provider>;
};

export const useCash = () => {
  const context = useContext(CashContext);
  if (!context) throw new Error('useCash must be used inside CashProvider.');
  return context;
};
