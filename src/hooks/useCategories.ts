import { useEffect, useState } from 'react';
import { query, orderBy, onSnapshot } from 'firebase/firestore';
import { categoriesCol } from '../lib/converters';
import { filterAndSortCategories } from '../lib/categoryHelpers';
import type { CategoryDoc } from '../types/models';

export function useCategories(gid: string | null) {
  const [all, setAll] = useState<CategoryDoc[]>([]);
  const [active, setActive] = useState<CategoryDoc[]>([]);
  // loadedGid tracks which gid the current data corresponds to.
  // loading = gid !== null and we haven't yet received a snapshot for it.
  const [loadedGid, setLoadedGid] = useState<string | null | 'none'>('none');

  useEffect(() => {
    if (!gid) return;
    const q = query(categoriesCol(gid), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
      const { all: sortedAll, active: sortedActive } = filterAndSortCategories(docs);
      setAll(sortedAll);
      setActive(sortedActive);
      setLoadedGid(gid);
    });
    return () => unsub();
  }, [gid]);

  const loading = gid !== null && loadedGid !== gid;

  return { all, active, loading };
}
