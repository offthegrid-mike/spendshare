import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { workSettingsRef } from '../lib/converters';
import { withDefaults } from '../lib/work/workSettings';
import type { WorkSettingsDoc } from '../types/models';

/**
 * A user's Work settings, with the defaults filling anything not saved yet.
 * `settings` keeps its identity between renders until the document changes, so
 * callers can safely list it in an effect's dependencies.
 */
export function useWorkSettings(
  uid: string | undefined,
): { settings: WorkSettingsDoc; loading: boolean } {
  const [raw, setRaw] = useState<WorkSettingsDoc | undefined>(undefined);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const key = uid || null;

  useEffect(() => {
    if (!uid) {
      return;
    }

    const unsub = onSnapshot(workSettingsRef(uid), (snap) => {
      setRaw(snap.exists() ? snap.data() : undefined);
      setLoadedKey(uid);
    }, () => {
      // Unblock loading so a failed listener cannot hang the screen; the
      // defaults stand in until a snapshot arrives.
      setLoadedKey(uid);
    });

    return () => {
      unsub();
      // Never show one user's settings to the next, and forget what was loaded,
      // so stepping A to B and back to A before B's first snapshot reports
      // loading instead of the defaults as if they were A's settings.
      setRaw(undefined);
      setLoadedKey(null);
    };
  }, [uid]);

  const settings = useMemo(() => withDefaults(raw), [raw]);
  const loading = key !== null && loadedKey !== key;

  return { settings, loading };
}
