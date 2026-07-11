import { useEffect, useState } from 'react';
import { query, where, orderBy, onSnapshot, collectionGroup } from 'firebase/firestore';
import { expensesCol } from '../lib/converters';
import { db } from '../lib/firebase';
import type { ExpenseDoc, ItemDoc } from '../types/models';

export function useMonthExpenses(
  gid: string | null,
  month: string,
): {
  expenses: ExpenseDoc[];
  itemsByExpense: Record<string, ItemDoc[]>;
  loading: boolean;
  itemsLoading: boolean;
} {
  const [expenses, setExpenses] = useState<ExpenseDoc[]>([]);
  const [itemsByExpense, setItemsByExpense] = useState<Record<string, ItemDoc[]>>({});
  const [expensesLoadedKey, setExpensesLoadedKey] = useState<string | null>(null);
  const [itemsLoadedKey, setItemsLoadedKey] = useState<string | null>(null);

  const key = gid ? `${gid}:${month}` : null;

  useEffect(() => {
    if (!gid) {
      return;
    }

    // Subscribe to expenses for this group+month
    const expQ = query(expensesCol(gid), where('month', '==', month), orderBy('date', 'desc'));
    const unsubExp = onSnapshot(expQ, (snap) => {
      setExpenses(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
      setExpensesLoadedKey(`${gid}:${month}`);
    }, () => {
      // Transient permission-denied can occur while membership propagates;
      // unblock loading and let the next snapshot resolve it.
      setExpensesLoadedKey(`${gid}:${month}`);
    });

    // Subscribe to all items for this group+month via collectionGroup
    const itemQ = query(
      collectionGroup(db, 'items'),
      where('groupId', '==', gid),
      where('month', '==', month),
    );
    const unsubItems = onSnapshot(itemQ, (snap) => {
      const map: Record<string, ItemDoc[]> = {};
      for (const d of snap.docs) {
        const item = { ...d.data(), id: d.id } as ItemDoc;
        if (!map[item.expenseId]) map[item.expenseId] = [];
        map[item.expenseId].push(item);
      }
      setItemsByExpense(map);
      setItemsLoadedKey(`${gid}:${month}`);
    }, () => {
      setItemsLoadedKey(`${gid}:${month}`);
    });

    return () => {
      unsubExp();
      unsubItems();
      // Reset stale data immediately when group/month changes
      setExpenses([]);
      setItemsByExpense({});
    };
  }, [gid, month]);

  // `loading` tracks the expenses listener alone, matching the original
  // semantics most callers (e.g. the expense list) rely on — they only need
  // expense docs to render. `itemsLoading` is separate so a caller that also
  // needs itemsByExpense fully hydrated before rendering (e.g. the
  // edit-expense form, to avoid mounting react-hook-form with stale
  // defaultValues) can wait on it explicitly without penalizing everyone else.
  const loading = gid !== null && expensesLoadedKey !== key;
  const itemsLoading = gid !== null && itemsLoadedKey !== key;

  return { expenses, itemsByExpense, loading, itemsLoading };
}
