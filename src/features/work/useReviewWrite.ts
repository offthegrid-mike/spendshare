import { useState } from 'react';
import type { WorkAction } from '../../lib/work/workDay';
import { writeWorkDay } from '../../lib/work/workWrite';
import type { WorkDayDoc, WorkSettingsDoc } from '../../types/models';
import { settleWrite } from './settleWrite';

export const REVIEW_WRITE_FAILED = "Couldn't update the day. Try again.";

/**
 * One write at a time from a Year tab review list: which day's write is on the
 * way, whether the last one failed, and a `run` that writes `action` to `day`.
 * Awaited only online (settleWrite), as Firestore's write promise never resolves
 * offline while the local cache already shows the change.
 */
export function useReviewWrite(uid: string, settings: WorkSettingsDoc | null) {
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function run(day: WorkDayDoc, action: WorkAction) {
    setBusyDate(day.date);
    setFailed(false);
    try {
      await settleWrite(writeWorkDay(uid, day.date, action, day, settings));
    } catch {
      setFailed(true);
    } finally {
      setBusyDate(null);
    }
  }

  return { busyDate, failed, run };
}
