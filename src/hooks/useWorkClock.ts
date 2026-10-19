import { useEffect, useState } from 'react';
import { clockNow, type Clock } from '../lib/work/workDates';

const TICK_MS = 60_000;

/**
 * The device's local date and minute of day, kept current: it ticks every
 * minute, and refreshes when the tab becomes visible again because a
 * backgrounded tab's timer is throttled. The same object is returned while the
 * minute has not changed, so consumers do not re-render on every tick.
 */
export function useWorkClock(): Clock {
  const [clock, setClock] = useState(() => clockNow());

  useEffect(() => {
    function refresh() {
      const next = clockNow();
      setClock((prev) =>
        prev.today === next.today && prev.nowMinutes === next.nowMinutes ? prev : next,
      );
    }

    const timer = setInterval(refresh, TICK_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return clock;
}
