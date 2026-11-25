import { useEffect, useState } from 'react';
import { collectionGroup, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { expensesCol } from '../lib/converters';
import type { ExpenseDoc, ItemDoc } from '../types/models';

/**
 * Every expense of a trip, newest first, and their items by expense id. A trip
 * is short, so unlike a household it loads whole rather than a month at a time.
 * `loading` covers the expenses, `itemsLoading` the items, as in useMonthExpenses.
 */
export function useTripExpenses(tripId: string | null): {
  expenses: ExpenseDoc[];
  itemsByExpense: Record<string, ItemDoc[]>;
  loading: boolean;
  itemsLoading: boolean;
  error: boolean;
} {
  const [expenses, setExpenses] = useState<ExpenseDoc[]>([]);
  const [itemsByExpense, setItemsByExpense] = useState<Record<string, ItemDoc[]>>({});
  const [expensesKey, setExpensesKey] = useState<string | null>(null);
  const [itemsKey, setItemsKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;
    const unsubExpenses = onSnapshot(
      query(expensesCol(tripId), orderBy('date', 'desc')),
      (snap) => {
        setExpenses(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setExpensesKey(tripId);
      },
      () => {
        setErrorKey(tripId);
        setExpensesKey(tripId);
      },
    );
    const unsubItems = onSnapshot(
      query(collectionGroup(db, 'items'), where('groupId', '==', tripId)),
      (snap) => {
        const map: Record<string, ItemDoc[]> = {};
        for (const d of snap.docs) {
          const item = { ...d.data(), id: d.id } as ItemDoc;
          (map[item.expenseId] ??= []).push(item);
        }
        setItemsByExpense(map);
        setItemsKey(tripId);
      },
      () => {
        setErrorKey(tripId);
        setItemsKey(tripId);
      },
    );
    return () => {
      unsubExpenses();
      unsubItems();
    };
  }, [tripId]);

  // Derived from the stored keys, so the effect never sets state synchronously
  // and a previous trip's data never shows as this one's.
  const current = tripId !== null && expensesKey === tripId;
  return {
    expenses: current ? expenses : [],
    itemsByExpense: current && itemsKey === tripId ? itemsByExpense : {},
    loading: tripId !== null && expensesKey !== tripId,
    itemsLoading: tripId !== null && itemsKey !== tripId,
    error: tripId !== null && errorKey === tripId,
  };
}
