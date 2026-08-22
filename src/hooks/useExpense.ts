import { useEffect, useState } from 'react';
import { doc, getDoc, getDocs } from 'firebase/firestore';
import { expensesCol, itemsCol } from '../lib/converters';
import type { ExpenseDoc, ItemDoc } from '../types/models';

/**
 * Loads one expense and its items by id. Unlike `useMonthExpenses`, this does not
 * depend on the selected month, so deep links and search results from any month
 * open correctly.
 */
export function useExpense(
  gid: string | null,
  id: string | undefined,
): { expense: ExpenseDoc | null; items: ItemDoc[]; loading: boolean } {
  const [expense, setExpense] = useState<ExpenseDoc | null>(null);
  const [items, setItems] = useState<ItemDoc[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const key = gid && id ? `${gid}:${id}` : null;

  useEffect(() => {
    if (!gid || !id) return;

    let cancelled = false;

    void (async () => {
      try {
        const [expSnap, itemSnap] = await Promise.all([
          getDoc(doc(expensesCol(gid), id)),
          getDocs(itemsCol(gid, id)),
        ]);
        if (cancelled) return;
        setExpense(expSnap.exists() ? { ...expSnap.data(), id: expSnap.id } : null);
        setItems(itemSnap.docs.map((d) => ({ ...d.data(), id: d.id })));
      } catch {
        if (!cancelled) setExpense(null);
      } finally {
        if (!cancelled) setLoadedKey(`${gid}:${id}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gid, id]);

  // Derived rather than stored so the effect never calls setState synchronously.
  const loading = key !== null && loadedKey !== key;

  return { expense, items, loading };
}
