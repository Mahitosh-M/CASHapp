import type { ShopId } from '../types';

export const SHOP_OPTIONS = [
  { id: 'SHOP_A', name: 'Shop A' },
  { id: 'SHOP_S', name: 'Shop S' }
] as const satisfies ReadonlyArray<{ id: ShopId; name: string }>;

export const isShopId = (value: unknown): value is ShopId => value === 'SHOP_A' || value === 'SHOP_S';

export const getShopName = (shopId: ShopId) => SHOP_OPTIONS.find((shop) => shop.id === shopId)?.name ?? 'Unknown shop';

export const getOtherShopId = (shopId: ShopId): ShopId => shopId === 'SHOP_A' ? 'SHOP_S' : 'SHOP_A';
