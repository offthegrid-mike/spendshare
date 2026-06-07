import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { groupsCol } from '../lib/converters';
import type { GroupDoc } from '../types/models';

export function useGroup(groupId: string | null) {
  const [group, setGroup] = useState<GroupDoc | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (!groupId) {
      return;
    }
    unsubRef.current = onSnapshot(doc(groupsCol, groupId), (snap) => {
      setGroup(snap.exists() ? { ...snap.data(), id: snap.id } : null);
      setLoadedId(groupId);
    });
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [groupId]);

  return { group, loading: groupId !== null && loadedId !== groupId };
}
