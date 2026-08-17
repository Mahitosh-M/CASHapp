import { History, Home, LogOut, ShieldCheck, WalletCards, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CashMovementPopup } from './CashMovementPopup';
import { InstallAppPrompt } from './InstallAppPrompt';
import { useAuth } from '../context/AuthContext';
import { useCash } from '../context/CashContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import type { CashBalanceSnapshot, CashMovement } from '../types';
import { createCashBalanceSnapshot, detectCashMovement } from '../utils/cash';
import { SHOP_OPTIONS, getShopName } from '../utils/shops';

const CASH_SNAPSHOT_PREFIX = 'cashAppBalanceSeen';
const snapshotFields: Array<keyof CashBalanceSnapshot> = [
  'availableBalance',
  'totalCollections',
  'totalExpenses',
  'totalTransferredIn',
  'totalTransferredOut',
  'openingBalance'
];

const isCashBalanceSnapshot = (value: unknown): value is CashBalanceSnapshot => {
  if (!value || typeof value !== 'object') return false;
  return snapshotFields.every((field) => {
    const fieldValue = (value as Record<string, unknown>)[field];
    return typeof fieldValue === 'number' && Number.isFinite(fieldValue);
  });
};

const readStoredSnapshot = (key: string) => {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return isCashBalanceSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writeStoredSnapshot = (key: string, snapshot: CashBalanceSnapshot) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // The in-memory snapshot still prevents repeated popups during this session.
  }
};

export const AppShell = () => {
  const { currentShopId, firebaseUser, profile, logout, setAdminShop } = useAuth();
  const { summary, summaryLoading } = useCash();
  const online = useOnlineStatus();
  const [cashMovement, setCashMovement] = useState<CashMovement | null>(null);
  const memorySnapshots = useRef<Record<string, CashBalanceSnapshot>>({});
  const currentSnapshot = useRef<{ key: string; value: CashBalanceSnapshot } | null>(null);
  const snapshotKey = firebaseUser && currentShopId
    ? `${CASH_SNAPSHOT_PREFIX}:${firebaseUser.uid}:${currentShopId}`
    : '';

  useEffect(() => {
    setCashMovement(null);
  }, [snapshotKey]);

  useEffect(() => {
    if (!snapshotKey || summaryLoading || !summary) return;

    const nextSnapshot = createCashBalanceSnapshot(summary);
    currentSnapshot.current = { key: snapshotKey, value: nextSnapshot };
    const previousSnapshot = readStoredSnapshot(snapshotKey) || memorySnapshots.current[snapshotKey];

    if (!previousSnapshot) {
      memorySnapshots.current[snapshotKey] = nextSnapshot;
      writeStoredSnapshot(snapshotKey, nextSnapshot);
      return;
    }

    const movement = detectCashMovement(previousSnapshot, nextSnapshot);
    if (!movement) {
      memorySnapshots.current[snapshotKey] = nextSnapshot;
      writeStoredSnapshot(snapshotKey, nextSnapshot);
      return;
    }

    setCashMovement(movement);
  }, [snapshotKey, summary, summaryLoading]);

  const closeCashMovement = useCallback(() => {
    const latestSnapshot = currentSnapshot.current;
    if (latestSnapshot) {
      memorySnapshots.current[latestSnapshot.key] = latestSnapshot.value;
      writeStoredSnapshot(latestSnapshot.key, latestSnapshot.value);
    }
    setCashMovement(null);
  }, []);

  return (
    <div className="app-frame">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">
            <div className="brand-mark"><WalletCards size={25} /></div>
            <div>
              <strong>Cash App</strong>
              <span className={`branch-line ${online ? 'online' : 'offline'}`}>
                {currentShopId ? getShopName(currentShopId) : 'Branch cash'}
              </span>
            </div>
          </div>
          <button className="icon-button header-logout" type="button" onClick={() => void logout()} title="Logout" aria-label="Logout">
            <LogOut size={21} />
          </button>
        </div>
        {profile?.role === 'Admin' ? (
          <div className="admin-shop-control" role="group" aria-label="Select shop">
            {SHOP_OPTIONS.map((shop) => (
              <button
                key={shop.id}
                type="button"
                className={currentShopId === shop.id ? 'selected' : ''}
                aria-pressed={currentShopId === shop.id}
                onClick={() => setAdminShop(shop.id)}
              >
                {shop.name}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {!online ? (
        <div className="offline-banner" role="status"><WifiOff size={17} /> No internet. Financial actions are disabled.</div>
      ) : null}

      <main className="app-content">
        <Outlet />
      </main>

      <nav className={`bottom-nav ${profile?.role === 'Admin' ? 'has-admin' : ''}`} aria-label="Main navigation">
        <NavLink to="/" end>
          <Home size={21} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/history">
          <History size={21} />
          <span>History</span>
        </NavLink>
        {profile?.role === 'Admin' ? (
          <NavLink to="/admin">
            <ShieldCheck size={21} />
            <span>Admin</span>
          </NavLink>
        ) : null}
      </nav>

      <InstallAppPrompt disabled={!online || Boolean(cashMovement)} />

      {cashMovement ? <CashMovementPopup movement={cashMovement} onClose={closeCashMovement} /> : null}
    </div>
  );
};
