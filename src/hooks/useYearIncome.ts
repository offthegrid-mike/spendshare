import { useEffect, useState } from 'react';
import { query, where, onSnapshot } from 'firebase/firestore';
import { incomeCol } from '../lib/converters';
import type { IncomeDoc } from '../types/models';

export function useYearIncome(
  gid: string | null,
  year: string,
): { income: IncomeDoc[]; loading: boolean } {
  const [income, setIncome] = useState<IncomeDoc[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const key = gid ? `${gid}:${year}` : null;

  useEffect(() => {
    if (!gid) {
      return;
    }

    const q = query(
      incomeCol(gid),
      where('month', '>=', `${year}-01`),
      where('month', '<=', `${year}-12`),
    );
    const unsub = onSnapshot(q, (snap) => {
      setIncome(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadedKey(`${gid}:${year}`);
    }, () => {
      setLoadedKey(`${gid}:${year}`);
    });

    return () => {
      unsub();
      setIncome([]);
    };
  }, [gid, year]);

  const loading = gid !== null && loadedKey !== key;

  return { income, loading };
}
