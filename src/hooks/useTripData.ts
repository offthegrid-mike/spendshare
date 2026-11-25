import { useMemo } from 'react';
import { tripCash, type TripCash } from '../lib/travel/cash';
import { useTripExpenses } from './useTripExpenses';
import { useTripWallets } from './useTripWallets';
import type { ExpenseDoc, ItemDoc, TopUpDoc, WalletDoc } from '../types/models';

/**
 * Everything a trip screen needs to show money: expenses and items, cash
 * wallets and top-ups, and the home value of each cash payment. `loading`
 * waits for the expenses and the wallets; `itemsLoading` for the items.
 */
export function useTripData(tripId: string | null): {
  expenses: ExpenseDoc[];
  itemsByExpense: Record<string, ItemDoc[]>;
  wallets: WalletDoc[];
  topUps: TopUpDoc[];
  cash: TripCash;
  loading: boolean;
  itemsLoading: boolean;
  error: boolean;
  retry: () => void;
} {
  const exp = useTripExpenses(tripId);
  const w = useTripWallets(tripId);
  const cash = useMemo(() => tripCash(w.wallets, w.topUps, exp.expenses), [w.wallets, w.topUps, exp.expenses]);
  return {
    expenses: exp.expenses,
    itemsByExpense: exp.itemsByExpense,
    wallets: w.wallets,
    topUps: w.topUps,
    cash,
    loading: exp.loading || w.loading,
    itemsLoading: exp.itemsLoading,
    error: exp.error || w.error,
    retry: () => {
      exp.retry();
      w.retry();
    },
  };
}
