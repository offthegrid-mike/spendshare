import { useEffect, useState } from 'react';
import { getDocs, query, where, orderBy, collectionGroup } from 'firebase/firestore';
import { expensesCol } from '../lib/converters';
import { db } from '../lib/firebase';
import type { ExpenseDoc, ItemDoc } from '../types/models';

interface GroupHistory {
  expenses: ExpenseDoc[];
  itemsByExpense: Record<string, ItemDoc[]>;
}

/** How long a loaded history is reused, so other members' changes still show up. */
export const HISTORY_TTL_MS = 5 * 60 * 1000;

// One copy per group for the session, shared by every screen that reads the
// whole history. Each entry drops itself when it expires.
const shared = new Map<string, { history: GroupHistory; expiry: ReturnType<typeof setTimeout> }>();

function keep(gid: string, history: GroupHistory) {
  invalidateGroupHistory(gid);
  shared.set(gid, { history, expiry: setTimeout(() => shared.delete(gid), HISTORY_TTL_MS) });
}

/** Forgets the group's shared history; call it after this device changes an expense. */
export function invalidateGroupHistory(gid: string): void {
  const entry = shared.get(gid);
  if (!entry) return;
  clearTimeout(entry.expiry);
  shared.delete(gid);
}

async function fetchHistory(gid: string): Promise<GroupHistory> {
  const [expSnap, itemSnap] = await Promise.all([
    getDocs(query(expensesCol(gid), orderBy('date', 'desc'))),
    getDocs(query(collectionGroup(db, 'items'), where('groupId', '==', gid))),
  ]);
  const itemsByExpense: Record<string, ItemDoc[]> = {};
  for (const d of itemSnap.docs) {
    const item = { ...d.data(), id: d.id } as ItemDoc;
    if (!itemsByExpense[item.expenseId]) itemsByExpense[item.expenseId] = [];
    itemsByExpense[item.expenseId].push(item);
  }
  return { expenses: expSnap.docs.map((d) => ({ ...d.data(), id: d.id })), itemsByExpense };
}

/**
 * Every expense (and every item) in a group, across all months.
 *
 * Deliberately not a live subscription: holding a listener over the group's whole
 * history would re-read on every write. Instead one fetched copy per group is
 * shared for HISTORY_TTL_MS, and dropped early when this device saves or deletes
 * an expense. `fresh` skips the shared copy, for callers that write from the result.
 */
export function useAllExpenses(gid: string | null, { fresh = false }: { fresh?: boolean } = {}): {
  expenses: ExpenseDoc[];
  itemsByExpense: Record<string, ItemDoc[]>;
  loading: boolean;
  error: string | null;
} {
  const [history, setHistory] = useState<GroupHistory>({ expenses: [], itemsByExpense: {} });
  const [loadedGid, setLoadedGid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gid) return;

    let cancelled = false;
    const reuse = fresh ? undefined : shared.get(gid)?.history;

    void (async () => {
      try {
        // A shared copy still resolves asynchronously, so the effect never sets state synchronously.
        const loaded = reuse ?? await fetchHistory(gid);
        if (!reuse) keep(gid, loaded);
        if (cancelled) return;
        setHistory(loaded);
        setError(null);
      } catch {
        if (!cancelled) setError('Could not load expenses. Please try again.');
      } finally {
        if (!cancelled) setLoadedGid(gid);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gid, fresh]);

  // Derived rather than stored so the effect never calls setState synchronously.
  const loading = gid !== null && loadedGid !== gid;

  return { ...history, loading, error };
}
