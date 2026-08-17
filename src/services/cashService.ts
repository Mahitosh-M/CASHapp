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
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  CashAdjustmentInput,
  CashInitializationInput,
  CashExpenseInput,
  CashHistoryCategory,
  CashHistoryItem,
  ShopCashSummary,
  ShopId,
  ShopTransferInput,
  ShopTransferRecord,
  ShopTransferUpdateInput
} from '../types';
import { createEmptyShopSummary, sortCashHistory } from '../utils/cash';
import { getShopName, isShopId } from '../utils/shops';

const SHOP_CASH = 'shopCash';
const CASH_EXPENSES = 'cashExpenses';
const SHOP_TRANSFERS = 'shopTransfers';
const CASH_ADJUSTMENTS = 'cashAdjustments';
const CASH_INITIALIZATIONS = 'cashInitializations';
const PAYMENTS = 'payments';
export const INSUFFICIENT_TRANSFER_EDIT_BALANCE = 'The sending shop does not have enough available amount for this increase.';

const numberOrZero = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const historyDateOrNull = (value: unknown) => {
  if (value instanceof Timestamp) return value;
  return typeof value === 'string' && value ? value : null;
};

const historyDateAsDate = (value: unknown) => {
  const historyDate = historyDateOrNull(value);
  if (!historyDate) return null;
  const date = typeof historyDate === 'string' ? new Date(historyDate) : historyDate.toDate();
  return Number.isNaN(date.getTime()) ? null : date;
};

const mapTransferRecord = (id: string, data: DocumentData): ShopTransferRecord | null => {
  if (!isShopId(data.fromShopId) || !isShopId(data.toShopId) || data.fromShopId === data.toShopId) return null;
  const amount = numberOrZero(data.amount);
  if (amount <= 0) return null;

  return {
    id,
    fromShopId: data.fromShopId,
    toShopId: data.toShopId,
    amount,
    note: String(data.note || ''),
    createdBy: String(data.createdBy || ''),
    createdAt: historyDateOrNull(data.createdAt),
    updatedAt: historyDateOrNull(data.updatedAt),
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined
  };
};

export const createExpenseId = () => doc(collection(db, CASH_EXPENSES)).id;
export const createTransferId = () => doc(collection(db, SHOP_TRANSFERS)).id;
export const createAdjustmentId = () => doc(collection(db, CASH_ADJUSTMENTS)).id;

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
    openingBalance: numberOrZero(data.openingBalance),
    initializedAt: typeof data.initializedAt === 'string' || data.initializedAt instanceof Timestamp
      ? data.initializedAt
      : null,
    initializedBy: typeof data.initializedBy === 'string' ? data.initializedBy : undefined,
    updatedAt: typeof data.updatedAt === 'string' || data.updatedAt instanceof Timestamp ? data.updatedAt : null
  };
};

export const initializeShopCash = async (input: CashInitializationInput) => {
  const batch = writeBatch(db);
  batch.set(doc(db, CASH_INITIALIZATIONS, input.shopId), {
    shopId: input.shopId,
    openingBalance: input.openingBalance,
    createdAt: serverTimestamp(),
    createdBy: input.createdBy
  });
  batch.set(doc(db, SHOP_CASH, input.shopId), {
    shopId: input.shopId,
    availableBalance: increment(input.openingBalance),
    totalCollections: increment(0),
    totalExpenses: increment(0),
    totalTransferredIn: increment(0),
    totalTransferredOut: increment(0),
    openingBalance: increment(input.openingBalance),
    lastCashOperationId: input.shopId,
    lastCashOperationType: 'initialization',
    initializedAt: serverTimestamp(),
    initializedBy: input.createdBy,
    updatedAt: new Date().toISOString()
  }, { merge: true });
  await batch.commit();
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
    lastCashOperationId: input.id,
    lastCashOperationType: 'expense',
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
    lastCashOperationId: input.id,
    lastCashOperationType: 'transfer',
    updatedAt: new Date().toISOString()
  });
  batch.update(doc(db, SHOP_CASH, input.toShopId), {
    availableBalance: increment(input.amount),
    totalTransferredIn: increment(input.amount),
    lastCashOperationId: input.id,
    lastCashOperationType: 'transfer',
    updatedAt: new Date().toISOString()
  });
  await batch.commit();
};

export const getTransfer = async (transferId: string): Promise<ShopTransferRecord | null> => {
  const transferSnapshot = await getDoc(doc(db, SHOP_TRANSFERS, transferId));
  return transferSnapshot.exists()
    ? mapTransferRecord(transferSnapshot.id, transferSnapshot.data())
    : null;
};

export const updateTransfer = async (input: ShopTransferUpdateInput) => runTransaction(db, async (transaction) => {
  const transferRef = doc(db, SHOP_TRANSFERS, input.id);
  const transferSnapshot = await transaction.get(transferRef);
  const existing = transferSnapshot.exists()
    ? mapTransferRecord(transferSnapshot.id, transferSnapshot.data())
    : null;
  if (!existing) throw new Error('Transfer entry was not found.');

  const amountDifference = input.amount - existing.amount;
  const updatedAt = new Date().toISOString();

  if (amountDifference !== 0) {
    const senderRef = doc(db, SHOP_CASH, existing.fromShopId);
    const receiverRef = doc(db, SHOP_CASH, existing.toShopId);
    const senderSnapshot = await transaction.get(senderRef);
    const receiverSnapshot = await transaction.get(receiverRef);
    if (!senderSnapshot.exists() || !receiverSnapshot.exists()) {
      throw new Error('Both shop balances must be initialized before editing this transfer.');
    }

    const sender = senderSnapshot.data();
    const receiver = receiverSnapshot.data();
    if (!sender.initializedAt || !receiver.initializedAt) {
      throw new Error('Both shop balances must be initialized before editing this transfer.');
    }

    const nextSenderBalance = numberOrZero(sender.availableBalance) - amountDifference;
    if (amountDifference > 0 && nextSenderBalance < 0) {
      throw new Error(INSUFFICIENT_TRANSFER_EDIT_BALANCE);
    }

    transaction.update(senderRef, {
      availableBalance: nextSenderBalance,
      totalTransferredOut: numberOrZero(sender.totalTransferredOut) + amountDifference,
      lastCashOperationId: input.id,
      lastCashOperationType: 'transfer_edit',
      updatedAt
    });
    transaction.update(receiverRef, {
      availableBalance: numberOrZero(receiver.availableBalance) + amountDifference,
      totalTransferredIn: numberOrZero(receiver.totalTransferredIn) + amountDifference,
      lastCashOperationId: input.id,
      lastCashOperationType: 'transfer_edit',
      updatedAt
    });
  }

  transaction.update(transferRef, {
    amount: input.amount,
    note: input.note.trim(),
    updatedAt: serverTimestamp(),
    updatedBy: input.updatedBy
  });

  return {
    previousAmount: existing.amount,
    amount: input.amount,
    amountDifference,
    fromShopId: existing.fromShopId,
    toShopId: existing.toShopId
  };
});

export const createCashAdjustment = async (input: CashAdjustmentInput) => {
  const delta = input.direction === 'add' ? input.amount : -input.amount;
  const batch = writeBatch(db);
  batch.set(doc(db, CASH_ADJUSTMENTS, input.id), {
    shopId: input.shopId,
    amount: input.amount,
    direction: input.direction,
    reason: input.reason.trim(),
    createdAt: serverTimestamp(),
    createdBy: input.createdBy
  });
  batch.update(doc(db, SHOP_CASH, input.shopId), {
    availableBalance: increment(delta),
    lastCashOperationId: input.id,
    lastCashOperationType: 'adjustment',
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
    createdAt: historyDateOrNull(data.createdAt)
  };
};

const mapTransferHistory = (
  snapshot: QueryDocumentSnapshot<DocumentData>,
  direction: 'in' | 'out'
): CashHistoryItem => {
  const data = snapshot.data();
  const otherShopId = direction === 'out' ? data.toShopId : data.fromShopId;
  const note = String(data.note || '').trim();
  const detail = [note, data.updatedAt ? 'Edited' : ''].filter(Boolean).join(' | ');
  return {
    id: snapshot.id,
    kind: direction === 'out' ? 'transfer-out' : 'transfer-in',
    amount: numberOrZero(data.amount),
    title: direction === 'out' ? `Transfer to ${getShopName(otherShopId)}` : `Received from ${getShopName(otherShopId)}`,
    detail: detail || undefined,
    createdAt: historyDateOrNull(data.createdAt)
  };
};

const mapAdjustmentHistory = (snapshot: QueryDocumentSnapshot<DocumentData>): CashHistoryItem => {
  const data = snapshot.data();
  const incoming = data.direction === 'add';
  return {
    id: snapshot.id,
    kind: incoming ? 'adjustment-in' : 'adjustment-out',
    amount: numberOrZero(data.amount),
    title: incoming ? 'Admin amount added' : 'Admin amount deducted',
    detail: String(data.reason || '').trim() || undefined,
    createdAt: historyDateOrNull(data.createdAt)
  };
};

const mapCollectionHistory = (snapshot: QueryDocumentSnapshot<DocumentData>): CashHistoryItem => {
  const data = snapshot.data();
  const customerName = String(data.customerName || '').trim();
  const invoiceNumber = String(data.invoiceNumber || '').trim();
  const paymentMode = String(data.mode || '').trim();
  const detail = [invoiceNumber ? `Invoice ${invoiceNumber}` : '', paymentMode].filter(Boolean).join(' | ');

  return {
    id: snapshot.id,
    kind: 'collection',
    amount: numberOrZero(data.cashSyncedAmount),
    title: customerName ? `Payment from ${customerName}` : 'Customer payment',
    detail: detail || undefined,
    createdAt: historyDateOrNull(data.createdAt)
  };
};

interface CashHistorySource {
  collectionName: string;
  filters: QueryConstraint[];
  mapRow: (snapshot: QueryDocumentSnapshot<DocumentData>) => CashHistoryItem;
  usesIsoDate: boolean;
}

const getCategoryHistorySource = (
  shopId: ShopId,
  category: CashHistoryCategory
): CashHistorySource => {
  if (category === 'collections') {
    return {
      collectionName: PAYMENTS,
      filters: [where('shopId', '==', shopId), where('affectsShopCash', '==', true)],
      mapRow: mapCollectionHistory,
      usesIsoDate: true
    };
  }

  if (category === 'expenses') {
    return {
      collectionName: CASH_EXPENSES,
      filters: [where('shopId', '==', shopId)],
      mapRow: mapExpenseHistory,
      usesIsoDate: false
    };
  }

  const direction = category === 'transfers-in' ? 'in' : 'out';
  return {
    collectionName: SHOP_TRANSFERS,
    filters: [where(direction === 'in' ? 'toShopId' : 'fromShopId', '==', shopId)],
    mapRow: (row) => mapTransferHistory(row, direction),
    usesIsoDate: false
  };
};

const getAdjustmentHistorySource = (shopId: ShopId): CashHistorySource => ({
  collectionName: CASH_ADJUSTMENTS,
  filters: [where('shopId', '==', shopId)],
  mapRow: mapAdjustmentHistory,
  usesIsoDate: false
});

const getRangeBoundary = (source: CashHistorySource, date: Date) => (
  source.usesIsoDate ? date.toISOString() : Timestamp.fromDate(date)
);

const readHistoryMonth = async (
  source: CashHistorySource,
  start: Date,
  end: Date
): Promise<CashHistoryItem[]> => {
  const snapshot = await getDocs(query(
    collection(db, source.collectionName),
    ...source.filters,
    where('createdAt', '>=', getRangeBoundary(source, start)),
    where('createdAt', '<', getRangeBoundary(source, end)),
    orderBy('createdAt', 'desc')
  ));
  return snapshot.docs.map(source.mapRow);
};

const readPreviousHistoryDates = async (
  source: CashHistorySource,
  before: Date
): Promise<Date[]> => {
  const dates: Date[] = [];
  let cutoff = before;

  while (dates.length < 240) {
    const snapshot = await getDocs(query(
      collection(db, source.collectionName),
      ...source.filters,
      where('createdAt', '<', getRangeBoundary(source, cutoff)),
      orderBy('createdAt', 'desc'),
      limit(1)
    ));
    if (snapshot.empty) break;

    const date = historyDateAsDate(snapshot.docs[0].data().createdAt);
    if (!date) break;
    dates.push(date);
    const nextCutoff = new Date(date.getFullYear(), date.getMonth(), 1);
    if (nextCutoff.getTime() >= cutoff.getTime()) break;
    cutoff = nextCutoff;
  }

  return dates;
};

export const getCashCategoryHistoryMonth = (
  shopId: ShopId,
  category: CashHistoryCategory,
  start: Date,
  end: Date
) => readHistoryMonth(getCategoryHistorySource(shopId, category), start, end);

export const getCashCategoryPreviousHistoryDates = (
  shopId: ShopId,
  category: CashHistoryCategory,
  before: Date
) => readPreviousHistoryDates(getCategoryHistorySource(shopId, category), before);

const getAllHistorySources = (shopId: ShopId) => [
  getCategoryHistorySource(shopId, 'collections'),
  getCategoryHistorySource(shopId, 'expenses'),
  getCategoryHistorySource(shopId, 'transfers-in'),
  getCategoryHistorySource(shopId, 'transfers-out'),
  getAdjustmentHistorySource(shopId)
];

export const getCashHistoryMonth = async (
  shopId: ShopId,
  start: Date,
  end: Date
): Promise<CashHistoryItem[]> => {
  const groups = await Promise.all(
    getAllHistorySources(shopId).map((source) => readHistoryMonth(source, start, end))
  );
  return sortCashHistory(groups);
};

export const getCashPreviousHistoryDates = async (
  shopId: ShopId,
  before: Date
): Promise<Date[]> => (
  (await Promise.all(
    getAllHistorySources(shopId).map((source) => readPreviousHistoryDates(source, before))
  )).flat()
);

export const getFriendlyCashError = (
  error: unknown,
  action: 'load' | 'initialize' | 'expense' | 'transfer' | 'adjustment' | 'history'
) => {
  console.error(`Cash App ${action} error`, error);
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';

  if (code === 'permission-denied') return 'This action is not permitted. Please contact Admin.';
  if (code === 'unavailable' || code === 'network-request-failed') return 'Check your internet connection and try again.';
  if (code === 'failed-precondition' && action === 'history') return 'History is not ready yet. Please contact Admin.';
  if (action === 'initialize') return 'Branch cash could not be initialized. Please try again.';
  if (action === 'expense') return 'Expense could not be saved. Please try again.';
  if (action === 'transfer') return 'Transfer was not completed. No amount was moved.';
  if (action === 'adjustment') return 'The available amount was not adjusted. Please try again.';
  if (action === 'history') return 'History could not be loaded. Please try again.';
  return 'Available amount could not be loaded. Please try again.';
};
