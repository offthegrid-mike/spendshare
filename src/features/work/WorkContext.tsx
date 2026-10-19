import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useWorkClock } from '../../hooks/useWorkClock';
import { useWorkSettings } from '../../hooks/useWorkSettings';
import type { Clock } from '../../lib/work/workDates';
import type { WorkSettingsDoc } from '../../types/models';

interface WorkValue {
  uid: string;
  settings: WorkSettingsDoc;
  /** True until the first settings snapshot (or a listener error) arrives. */
  settingsLoading: boolean;
  /** True only once a real settings snapshot has arrived; false after a listener error. */
  settingsLoaded: boolean;
  clock: Clock;
}

const WorkContext = createContext<WorkValue | null>(null);

/** Shares the user's Work settings and the ticking clock with every Work screen. */
export function WorkProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const { settings, loading, loaded } = useWorkSettings(uid);
  const clock = useWorkClock();
  const value = useMemo(
    () => ({ uid, settings, settingsLoading: loading, settingsLoaded: loaded, clock }),
    [uid, settings, loading, loaded, clock],
  );
  return <WorkContext.Provider value={value}>{children}</WorkContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- the hook belongs beside its provider
export function useWork(): WorkValue {
  const value = useContext(WorkContext);
  if (!value) throw new Error('useWork must be used inside a WorkProvider');
  return value;
}
