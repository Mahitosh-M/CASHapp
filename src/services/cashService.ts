import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  CashExpenseInput,
  CashHistoryItem,
  ShopCashSummary,
  ShopId,
  ShopTransferInput
} from '../types';
import { createEmptyShopSummary, mergeRecentHistory } from '../utils/cash';
import { getShopName } from '../utils/shops';

const SHOP_CASH = 'shopCash';
const CASH_EXPENSES = 'cashExpenses';
const SHOP_TRANSFERS = 'shopTransfers';
const HISTORY_QUERY_LIMIT = 10;
const HISTORY_DISPLAY_LIMIT = 20;

const numberOrZero = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const timestampOrNull = (value: unknown) => value instanceof Timestamp ? value : null;

export const createExpenseId = () => doc(collection(db, CASH_EXPENSES)).id;
export const createTransferId = () => doc(collection(db, SHOP_TRANSFERS)).id;

export const getShopCash = async (shopId: ShopId): Promise<ShopCashSummary | null> => {
  const summarySnapshot = await getDoc(doc(db, SHOP_CASH, shopId));
  if (!summarySnapshot.exists()) return null;

  const data = summarySnapshot.data();
  return {
    ...createEmptyShopSummary(shopId),
    shopId,
    availableBalance: numberOrZero(data.availableBalance),
    totalCollections: numberOrZero(data.totalCollections),
    totalExpenses: numberOrZero(data.totalExpenses),
    totalTransferredIn: numberOrZero(data.totalTransferredIn),
    totalTransferredOut: numberOrZero(data.totalTransferredOut),
    updatedAt: typeof data.updatedAt === 'string' || data.updatedAt instanceof Timestamp ? data.updatedAt : null
  };
};

export const createExpense = async (input: CashExpenseInput) => {
  const batch = writeBatch(db);
  batch.set(doc(db, CASH_EXPENSES, input.id), {
    shopId: input.shopId,
    amount: input.amount,
    description: input.description.trim(),
    createdAt: serverTimestamp(),
    createdBy: input.createdBy
  });
  batch.update(doc(db, SHOP_CASH, input.shopId), {
    availableBalance: increment(-input.amount),
    totalExpenses: increment(input.amount),
    updatedAt: new Date().toISOString()
  });
  await batch.commit();
};

export const createTransfer = async (input: ShopTransferInput) => {
  const batch = writeBatch(db);
  batch.set(doc(db, SHOP_TRANSFERS, input.id), {
    fromShopId: input.fromShopId,
    toShopId: input.toShopId,
    amount: input.amount,
    note: input.note.trim(),
    createdAt: serverTimestamp(),
    createdBy: input.createdBy
  });
  batch.update(doc(db, SHOP_CASH, input.fromShopId), {
    availableBalance: increment(-input.amount),
    totalTransferredOut: increment(input.amount),
    updatedAt: new Date().toISOString()
  });
  batch.update(doc(db, SHOP_CASH, input.toShopId), {
    availableBalance: increment(input.amount),
    totalTransferredIn: increment(input.amount),
    updatedAt: new Date().toISOString()
  });
  await batch.commit();
};

const mapExpenseHistory = (snapshot: QueryDocumentSnapshot<DocumentData>): CashHistoryItem => {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    kind: 'expense',
    amount: numberOrZero(data.amount),
    title: String(data.description || 'Expense'),
    createdAt: timestampOrNull(data.createdAt)
  };
};

const mapTransferHistory = (
  snapshot: QueryDocumentSnapshot<DocumentData>,
  direction: 'in' | 'out'
): CashHistoryItem => {
  const data = snapshot.data();
  const otherShopId = direction === 'out' ? data.toShopId : data.fromShopId;
  return {
    id: snapshot.id,
    kind: direction === 'out' ? 'transfer-out' : 'transfer-in',
    amount: numberOrZero(data.amount),
    title: direction === 'out' ? `Transfer to ${getShopName(otherShopId)}` : `Received from ${getShopName(otherShopId)}`,
    detail: String(data.note || '').trim() || undefined,
    createdAt: timestampOrNull(data.createdAt)
  };
};

export const getRecentCashHistory = async (shopId: ShopId): Promise<CashHistoryItem[]> => {
  const expensesQuery = query(
    collection(db, CASH_EXPENSES),
    where('shopId', '==', shopId),
    orderBy('createdAt', 'desc'),
    limit(HISTORY_QUERY_LIMIT)
  );
  const outgoingQuery = query(
    collection(db, SHOP_TRANSFERS),
    where('fromShopId', '==', shopId),
    orderBy('createdAt', 'desc'),
    limit(HISTORY_QUERY_LIMIT)
  );
  const incomingQuery = query(
    collection(db, SHOP_TRANSFERS),
    where('toShopId', '==', shopId),
    orderBy('createdAt', 'desc'),
    limit(HISTORY_QUERY_LIMIT)
  );

  const [expenses, outgoing, incoming] = await Promise.all([
    getDocs(expensesQuery),
    getDocs(outgoingQuery),
    getDocs(incomingQuery)
  ]);

  return mergeRecentHistory([
    expenses.docs.map(mapExpenseHistory),
    outgoing.docs.map((row) => mapTransferHistory(row, 'out')),
    incoming.docs.map((row) => mapTransferHistory(row, 'in'))
  ], HISTORY_DISPLAY_LIMIT);
};

export const getFriendlyCashError = (error: unknown, action: 'load' | 'expense' | 'transfer' | 'history') => {
  console.error(`Cash App ${action} error`, error);
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';

  if (code === 'permission-denied') return 'This action is not permitted. Please contact Admin.';
  if (code === 'unavailable' || code === 'network-request-failed') return 'Check your internet connection and try again.';
  if (code === 'failed-precondition' && action === 'history') return 'History is not ready yet. Please contact Admin.';
  if (action === 'expense') return 'Expense could not be saved. Please try again.';
  if (action === 'transfer') return 'Transfer was not completed. No amount was moved.';
  if (action === 'history') return 'History could not be loaded. Please try again.';
  return 'Available amount could not be loaded. Please try again.';
};
