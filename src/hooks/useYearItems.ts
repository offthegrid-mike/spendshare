import { useEffect, useState } from 'react';
import { query, where, onSnapshot, collectionGroup } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ItemDoc } from '../types/models';

export function useYearItems(
  gid: string | null,
  year: string,
): { items: ItemDoc[]; loading: boolean } {
  const [items, setItems] = useState<ItemDoc[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const key = gid ? `${gid}:${year}` : null;

  useEffect(() => {
    if (!gid) {
      return;
    }

    // `month` is a 'YYYY-MM' string, so a lexical range covers the whole year.
    // Served by the existing items (groupId ASC, month ASC) collection-group index.
    const itemQ = query(
      collectionGroup(db, 'items'),
      where('groupId', '==', gid),
      where('month', '>=', `${year}-01`),
      where('month', '<=', `${year}-12`),
    );

    const unsub = onSnapshot(itemQ, (snap) => {
      setItems(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ItemDoc));
      setLoadedKey(`${gid}:${year}`);
    }, () => {
      // Transient permission-denied can occur while membership propagates;
      // unblock loading and let the next snapshot resolve it.
      setLoadedKey(`${gid}:${year}`);
    });

    return () => {
      unsub();
      setItems([]);
    };
  }, [gid, year]);

  const loading = gid !== null && loadedKey !== key;

  return { items, loading };
}
