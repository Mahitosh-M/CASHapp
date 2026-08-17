import type { Timestamp } from 'firebase/firestore';

export type ShopId = 'SHOP_A' | 'SHOP_S';
export type CashAppRole = 'Admin' | 'Staff';

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
  updatedAt?: string | Timestamp | null;
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

export interface CashHistoryItem {
  id: string;
  kind: 'expense' | 'transfer-in' | 'transfer-out';
  amount: number;
  title: string;
  detail?: string;
  createdAt?: Timestamp | null;
}
