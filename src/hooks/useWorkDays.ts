import { useEffect, useState } from 'react';
import { query, where, documentId, onSnapshot } from 'firebase/firestore';
import { workDaysCol } from '../lib/converters';
import { incomeYearRange } from '../lib/work/workDates';
import type { WorkDayDoc } from '../types/models';

/**
 * A user's Work days for one income year, ascending by date. A day's document
 * id is its date, so the year is a document-id range, which Firestore serves
 * without a composite index. `error` says the listener failed, so the empty
 * `days` it leaves are not a year with nothing recorded.
 */
export function useWorkDays(
  uid: string | undefined,
  incomeYear: string,
): { days: WorkDayDoc[]; loading: boolean; error: boolean } {
  const [days, setDays] = useState<WorkDayDoc[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  const key = uid ? `${uid}:${incomeYear}` : null;

  useEffect(() => {
    if (!uid) {
      return;
    }

    const { start, end } = incomeYearRange(incomeYear);
    const q = query(
      workDaysCol(uid),
      where(documentId(), '>=', start),
      where(documentId(), '<=', end),
    );
    const unsub = onSnapshot(q, (snap) => {
      const next = snap.docs.map((d) => ({ ...d.data(), date: d.id }));
      next.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      setDays(next);
      setLoadedKey(`${uid}:${incomeYear}`);
      setFailedKey(null);
    }, () => {
      // Unblock loading so a failed listener (e.g. a transient permission
      // error) cannot leave the screen waiting forever, and say it failed.
      setLoadedKey(`${uid}:${incomeYear}`);
      setFailedKey(`${uid}:${incomeYear}`);
    });

    return () => {
      unsub();
      // Reset stale days immediately when the user or income year changes, and
      // forget what was loaded or failed, so stepping A to B and back to A before
      // B's first snapshot reports loading instead of an empty result for A.
      setDays([]);
      setLoadedKey(null);
      setFailedKey(null);
    };
  }, [uid, incomeYear]);

  const loading = key !== null && loadedKey !== key;
  const error = key !== null && failedKey === key;

  return { days, loading, error };
}
