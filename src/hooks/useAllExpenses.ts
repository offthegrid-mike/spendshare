import { useEffect, useState } from 'react';
import { getDocs, query, where, orderBy, collectionGroup } from 'firebase/firestore';
import { expensesCol } from '../lib/converters';
import { db } from '../lib/firebase';
import type { ExpenseDoc, ItemDoc } from '../types/models';

/**
 * One-shot fetch of every expense (and every item) in a group, across all months.
 *
 * Deliberately not a live subscription: search is a short visit, and holding a
 * listener over the group's whole history would re-read on every write. Refetching
 * on each mount keeps results correct after an edit.
 */
export function useAllExpenses(gid: string | null): {
  expenses: ExpenseDoc[];
  itemsByExpense: Record<string, ItemDoc[]>;
  loading: boolean;
  error: string | null;
} {
  const [expenses, setExpenses] = useState<ExpenseDoc[]>([]);
  const [itemsByExpense, setItemsByExpense] = useState<Record<string, ItemDoc[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gid) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const [expSnap, itemSnap] = await Promise.all([
          getDocs(query(expensesCol(gid), orderBy('date', 'desc'))),
          getDocs(query(collectionGroup(db, 'items'), where('groupId', '==', gid))),
        ]);
        if (cancelled) return;

        setExpenses(expSnap.docs.map((d) => ({ ...d.data(), id: d.id })));

        const map: Record<string, ItemDoc[]> = {};
        for (const d of itemSnap.docs) {
          const item = { ...d.data(), id: d.id } as ItemDoc;
          if (!map[item.expenseId]) map[item.expenseId] = [];
          map[item.expenseId].push(item);
        }
        setItemsByExpense(map);
      } catch {
        if (!cancelled) setError('Could not load expenses. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gid]);

  return { expenses, itemsByExpense, loading, error };
}
