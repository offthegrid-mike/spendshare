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

/**
 * One copy of each group's history for the session, shared by every screen that
 * reads it. `generation` goes up whenever the copy stops being trustworthy (this
 * device changed an expense, or a fresh load started); a load only becomes the
 * copy if the generation hasn't moved since it started.
 */
interface GroupEntry {
  generation: number;
  loading?: Promise<GroupHistory>;
  history?: GroupHistory;
  expiry?: ReturnType<typeof setTimeout>;
}

const historyCache = new Map<string, GroupEntry>();

function entryFor(gid: string): GroupEntry {
  let entry = historyCache.get(gid);
  if (!entry) {
    entry = { generation: 0 };
    historyCache.set(gid, entry);
  }
  return entry;
}

/** Drops the group's copy and any load in flight, so the next reader fetches again. */
function startOver(entry: GroupEntry) {
  clearTimeout(entry.expiry);
  entry.generation += 1;
  entry.loading = undefined;
  entry.history = undefined;
  entry.expiry = undefined;
}

/** Forgets the group's shared history; call it when this device changes an expense. */
export function invalidateGroupHistory(gid: string): void {
  const entry = historyCache.get(gid);
  if (entry) startOver(entry);
}

/** Forgets every group's shared history, for example on sign-out. */
export function clearGroupHistory(): void {
  for (const entry of historyCache.values()) startOver(entry);
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

/** The shared copy, a load already in flight, or a new load (always new when `fresh`). */
function loadHistory(gid: string, fresh: boolean): Promise<GroupHistory> {
  const entry = entryFor(gid);
  if (fresh) startOver(entry);
  else if (entry.history) return Promise.resolve(entry.history);
  else if (entry.loading) return entry.loading;

  const generation = entry.generation;
  const loading = fetchHistory(gid);
  entry.loading = loading;
  loading.then(
    (history) => {
      if (entry.generation !== generation) return;
      entry.loading = undefined;
      entry.history = history;
      entry.expiry = setTimeout(() => {
        if (entry.generation === generation) startOver(entry);
      }, HISTORY_TTL_MS);
    },
    () => {
      // A failed load isn't kept; the next reader tries again.
      if (entry.generation === generation) entry.loading = undefined;
    },
  );
  return loading;
}

/**
 * Every expense (and every item) in a group, across all months.
 *
 * Deliberately not a live subscription: holding a listener over the group's whole
 * history would re-read on every write. Instead one loaded copy per group is
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
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = gid === null ? null : `${gid}:${fresh ? 'fresh' : 'shared'}`;

  useEffect(() => {
    if (!gid) return;

    let cancelled = false;
    const promise = loadHistory(gid, fresh);

    // Settles in a later microtask even for the shared copy, so the effect never
    // sets state synchronously.
    promise.then(
      (loaded) => {
        if (cancelled) return;
        setHistory(loaded);
        setError(null);
        setLoadedKey(`${gid}:${fresh ? 'fresh' : 'shared'}`);
      },
      () => {
        if (cancelled) return;
        setError('Could not load expenses. Please try again.');
        setLoadedKey(`${gid}:${fresh ? 'fresh' : 'shared'}`);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [gid, fresh]);

  // Derived rather than stored so the effect never calls setState synchronously.
  const loading = key !== null && loadedKey !== key;

  return { ...history, loading, error };
}
