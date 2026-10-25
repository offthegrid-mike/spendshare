import { useEffect, useState } from 'react';
import { getDocs, query, where } from 'firebase/firestore';
import { expensesCol } from '../lib/converters';
import type { ExpenseDoc } from '../types/models';

/**
 * The refunds made from an expense, from any month. One-shot rather than live:
 * it backs the refund page, the original's "Refunded" line and the delete check,
 * which all read it when they open.
 */
export function useRefunds(
  gid: string | null,
  expenseId: string | undefined,
): { refunds: ExpenseDoc[]; loading: boolean; error: boolean } {
  const [refunds, setRefunds] = useState<ExpenseDoc[]>([]);
  const [error, setError] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const key = gid && expenseId ? `${gid}:${expenseId}` : null;

  useEffect(() => {
    if (!gid || !expenseId) return;
    let cancelled = false;
    getDocs(query(expensesCol(gid), where('refundOf', '==', expenseId))).then(
      (snap) => {
        if (cancelled) return;
        setRefunds(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setError(false);
        setLoadedKey(`${gid}:${expenseId}`);
      },
      () => {
        if (cancelled) return;
        setError(true);
        setLoadedKey(`${gid}:${expenseId}`);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [gid, expenseId]);

  // Derived rather than stored so the effect never calls setState synchronously.
  const loading = key !== null && loadedKey !== key;
  return { refunds: key ? refunds : [], loading, error: key ? error : false };
}
