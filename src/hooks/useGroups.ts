import { useEffect, useRef, useState } from 'react';
import { query, where, onSnapshot } from 'firebase/firestore';
import { groupsCol } from '../lib/converters';
import type { GroupDoc } from '../types/models';

export function useGroups(uid: string | undefined) {
  const [groups, setGroups] = useState<GroupDoc[]>([]);
  const [loadedUid, setLoadedUid] = useState<string | undefined>(undefined);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (!uid) {
      return;
    }
    const q = query(groupsCol, where('memberUids', 'array-contains', uid));
    unsubRef.current = onSnapshot(q, (snap) => {
      setGroups(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
      setLoadedUid(uid);
    }, () => {
      // On error (e.g. permission-denied before rules allow), unblock loading
      setLoadedUid(uid);
    });
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [uid]);

  return { groups, loading: uid !== undefined && loadedUid !== uid };
}
