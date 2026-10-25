import { useEffect, useState } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { expensesCol } from '../lib/converters';
import type { ExpenseDoc } from '../types/models';

type Loaded = { key: string; refunds: ExpenseDoc[]; error: boolean };

const NONE: ExpenseDoc[] = [];

/**
 * The refunds made from an expense, from any month, kept live so the
 * original's "Refunded" line follows a refund saved or deleted anywhere. It
 * backs the refund page, editing a refund, and the floor on editing the
 * original; the list's delete check queries once on its own.
 */
export function useRefunds(
  gid: string | null,
  expenseId: string | undefined,
): { refunds: ExpenseDoc[]; loading: boolean; error: boolean } {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const key = gid && expenseId ? `${gid}:${expenseId}` : null;

  useEffect(() => {
    if (!gid || !expenseId) return;
    const loadedKey = `${gid}:${expenseId}`;
    return onSnapshot(
      query(expensesCol(gid), where('refundOf', '==', expenseId)),
      (snap) => setLoaded({ key: loadedKey, refunds: snap.docs.map((d) => ({ ...d.data(), id: d.id })), error: false }),
      () => setLoaded({ key: loadedKey, refunds: NONE, error: true }),
    );
  }, [gid, expenseId]);

  // Derived from the stored key, so another expense's refunds never show while this one loads.
  if (key === null) return { refunds: NONE, loading: false, error: false };
  if (loaded?.key !== key) return { refunds: NONE, loading: true, error: false };
  return { refunds: loaded.refunds, loading: false, error: loaded.error };
}
