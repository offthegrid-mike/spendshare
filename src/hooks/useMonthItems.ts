import { useEffect, useState } from 'react';
import { query, where, onSnapshot, collectionGroup } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ItemDoc } from '../types/models';

export function useMonthItems(
  gid: string | null,
  month: string,
): { items: ItemDoc[]; loading: boolean } {
  const [items, setItems] = useState<ItemDoc[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const key = gid ? `${gid}:${month}` : null;

  useEffect(() => {
    if (!gid) {
      return;
    }

    // items are nested under expenses — collectionGroup is the only way to query
    // all items for a group+month without iterating each expense doc individually.
    const itemQ = query(
      collectionGroup(db, 'items'),
      where('groupId', '==', gid),
      where('month', '==', month),
    );

    const unsub = onSnapshot(itemQ, (snap) => {
      setItems(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ItemDoc));
      setLoadedKey(`${gid}:${month}`);
    });

    return () => {
      unsub();
      setItems([]);
    };
  }, [gid, month]);

  const loading = gid !== null && loadedKey !== key;

  return { items, loading };
}
