import {
  Banknote,
  Building2,
  Ellipsis,
  Fuel,
  Landmark,
  PackageOpen,
  Truck,
  Zap
} from 'lucide-react';
import type { ExpenseCategory } from '../types';

export const ExpenseCategoryIcon = ({ category, size = 22 }: { category: ExpenseCategory; size?: number }) => {
  if (category === 'salary') return <Banknote size={size} />;
  if (category === 'fuel') return <Fuel size={size} />;
  if (category === 'electricity') return <Zap size={size} />;
  if (category === 'rent') return <Building2 size={size} />;
  if (category === 'transport') return <Truck size={size} />;
  if (category === 'supplies') return <PackageOpen size={size} />;
  if (category === 'taxes') return <Landmark size={size} />;
  return <Ellipsis size={size} />;
};
