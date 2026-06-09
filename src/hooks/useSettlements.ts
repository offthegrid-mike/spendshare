import { useEffect, useState } from 'react';
import { query, where, onSnapshot } from 'firebase/firestore';
import { settlementsCol } from '../lib/converters';
import type { SettlementDoc } from '../types/models';

export function useSettlements(
  gid: string | null,
  selectedMonth: string,
): { settlements: SettlementDoc[]; loading: boolean } {
  const [settlements, setSettlements] = useState<SettlementDoc[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const key = gid ? `${gid}:${selectedMonth}` : null;

  useEffect(() => {
    if (!gid) {
      return;
    }

    const q = query(settlementsCol(gid), where('month', '==', selectedMonth));
    const unsub = onSnapshot(q, (snap) => {
      setSettlements(snap.docs.map((d) => d.data()));
      setLoadedKey(`${gid}:${selectedMonth}`);
    });

    return () => {
      unsub();
      setSettlements([]);
    };
  }, [gid, selectedMonth]);

  const loading = gid !== null && loadedKey !== key;

  return { settlements, loading };
}
