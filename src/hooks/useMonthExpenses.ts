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
  itemsLoaded: boolean;
  loading: boolean;
} {
  const [expenses, setExpenses] = useState<ExpenseDoc[]>([]);
  const [itemsByExpense, setItemsByExpense] = useState<Record<string, ItemDoc[]>>({});
  // Tracks whether the items subscription has emitted at least once. The items
  // arrive on a separate snapshot from the expenses, so consumers that need the
  // full picture (e.g. the edit route) must wait for this, not just `loading`.
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const key = gid ? `${gid}:${month}` : null;

  useEffect(() => {
    if (!gid) {
      return;
    }

    // Subscribe to expenses for this group+month
    const expQ = query(expensesCol(gid), where('month', '==', month), orderBy('date', 'desc'));
    const unsubExp = onSnapshot(expQ, (snap) => {
      setExpenses(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
      setLoadedKey(`${gid}:${month}`);
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
      setItemsLoaded(true);
    });

    return () => {
      unsubExp();
      unsubItems();
      // Reset stale data immediately when group/month changes
      setExpenses([]);
      setItemsByExpense({});
      setItemsLoaded(false);
    };
  }, [gid, month]);

  const loading = gid !== null && loadedKey !== key;

  return { expenses, itemsByExpense, itemsLoaded, loading };
}
