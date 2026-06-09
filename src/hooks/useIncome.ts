import { useEffect, useState } from 'react';
import { query, where, onSnapshot } from 'firebase/firestore';
import { incomeCol } from '../lib/converters';
import type { IncomeDoc } from '../types/models';

export function useIncome(
  gid: string | null,
  selectedMonth: string,
): { income: IncomeDoc[]; loading: boolean } {
  const [income, setIncome] = useState<IncomeDoc[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const key = gid ? `${gid}:${selectedMonth}` : null;

  useEffect(() => {
    if (!gid) {
      return;
    }

    const q = query(incomeCol(gid), where('month', '==', selectedMonth));
    const unsub = onSnapshot(q, (snap) => {
      setIncome(snap.docs.map((d) => d.data()));
      setLoadedKey(`${gid}:${selectedMonth}`);
    });

    return () => {
      unsub();
      setIncome([]);
    };
  }, [gid, selectedMonth]);

  const loading = gid !== null && loadedKey !== key;

  return { income, loading };
}
