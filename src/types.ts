import type { Timestamp } from 'firebase/firestore';

export type ShopId = 'SHOP_A' | 'SHOP_S';
export type CashAppRole = 'Admin' | 'Staff';
export type CashAdjustmentDirection = 'add' | 'deduct';
export type CashHistoryCategory = 'collections' | 'expenses' | 'transfers-in' | 'transfers-out';

export interface StaffProfile {
  id: string;
  uid: string;
  email: string;
  name: string;
  role: CashAppRole;
  shopId?: ShopId;
  active: boolean;
}

export interface ShopCashSummary {
  shopId: ShopId;
  availableBalance: number;
  totalCollections: number;
  totalExpenses: number;
  totalTransferredIn: number;
  totalTransferredOut: number;
  openingBalance: number;
  initializedAt?: string | Timestamp | null;
  initializedBy?: string;
  updatedAt?: string | Timestamp | null;
}

export interface CashBalanceSnapshot {
  availableBalance: number;
  totalCollections: number;
  totalExpenses: number;
  totalTransferredIn: number;
  totalTransferredOut: number;
  openingBalance: number;
}

export type CashMovementKind = 'collection' | 'expense' | 'transfer-in' | 'transfer-out' | 'initialization' | 'adjustment';

export interface CashMovement {
  direction: 'in' | 'out';
  kind: CashMovementKind;
  amount: number;
  balance: number;
}

export interface CashInitializationInput {
  shopId: ShopId;
  openingBalance: number;
  createdBy: string;
}

export interface CashExpenseInput {
  id: string;
  shopId: ShopId;
  amount: number;
  description: string;
  createdBy: string;
}

export interface ShopTransferInput {
  id: string;
  fromShopId: ShopId;
  toShopId: ShopId;
  amount: number;
  note: string;
  createdBy: string;
}

export interface CashAdjustmentInput {
  id: string;
  shopId: ShopId;
  amount: number;
  direction: CashAdjustmentDirection;
  reason: string;
  createdBy: string;
}

export interface CashHistoryItem {
  id: string;
  kind: 'collection' | 'expense' | 'transfer-in' | 'transfer-out' | 'adjustment-in' | 'adjustment-out';
  amount: number;
  title: string;
  detail?: string;
  createdAt?: Timestamp | string | null;
}
