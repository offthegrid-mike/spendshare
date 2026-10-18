import {
  arrayUnion,
  deleteField,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
  type PartialWithFieldValue,
} from 'firebase/firestore';
import type { WorkDayDoc, WorkSettingsDoc } from '../../types/models';
import { workDayRef, workSettingsRef } from '../converters';
import { db } from '../firebase';
import { planWorkDayWrite, type WorkAction } from './workDay';
import { clockNow } from './workDates';

// Turns a plan from planWorkDayWrite into Firestore writes.
//
// A save is one merging write: no read first and no transaction. The existing
// document the plan was judged against is already in the caller's hands, and a
// read-modify-write or a transaction would need the server, so it could not run
// offline. Every save names the full set of day fields on purpose: a partial
// confirm or include that raced another device's edit could act on times the user
// never saw. `merge: true` is used so that one call creates or updates the
// document, so `deleteField()` can drop the fields that stopped applying (the
// times of a day that is no longer Home, a stale confirmation time), and so the
// timestamp fields a write does not name are kept (`firstRecordedAt`, and
// `recordedAt` / `finishConfirmedAt` when this write leaves them unchanged). The
// revision is appended on the server with arrayUnion rather than by writing back
// an array we read.
//
// The day and, for a first-ever day, the tracking start date go in ONE batch
// (always a batch, so there is a single code path). Offline, a Firestore write
// promise does not resolve until the server acknowledges it, so awaiting the day
// write and then writing the start date would never reach the second write while
// offline: several days recorded offline would each overwrite the start date, and
// closing the app would lose it. A batch is atomic and queues offline, and the
// local cache shows the new start date at once, so later saves skip it.
//
// Contract: the returned promise resolves only when the server acknowledges the
// write, and never while offline. The write itself is queued in the local cache
// straight away, so callers must not block the UI on this promise.

/**
 * Writes `action` to the Work day `date` for `uid`, as one atomic batch. Writes
 * nothing (and creates no batch) if the action changes nothing. `existing` is the
 * day's current document (null if none). `settings` is the current Work settings:
 * while its tracking start date is unset, the same batch sets it to `date`, the
 * first day saved.
 *
 * Precondition: pass the loaded settings snapshot, or null while the settings are
 * not loaded yet. Never pass the defaults a settings hook returns while loading or
 * after a listener error: their tracking start date is null, so the batch would
 * replace the user's real start date. With null, only the day is written and the
 * start date is left alone.
 */
export async function writeWorkDay(
  uid: string,
  date: string,
  action: WorkAction,
  existing: WorkDayDoc | null,
  settings: WorkSettingsDoc | null,
  now: number = Date.now(),
): Promise<void> {
  const plan = planWorkDayWrite(date, action, existing, clockNow(now).today);
  if (plan === null) return;

  const at = Timestamp.fromMillis(now);
  const { fields } = plan;
  const data: PartialWithFieldValue<WorkDayDoc> = {
    ...fields,
    // A merge keeps old values, so a field the plan leaves out has to be deleted.
    startTime: fields.startTime ?? deleteField(),
    finishTime: fields.finishTime ?? deleteField(),
    minutes: fields.minutes ?? deleteField(),
    syncedAt: serverTimestamp(),
    revisions: arrayUnion({ ...plan.revision, at }),
  };
  if (plan.isNew) data.firstRecordedAt = at;
  if (plan.isNew || plan.changedRecord) data.recordedAt = at;
  // An include or exclude on a confirmed day leaves the old confirmation time alone.
  if (plan.confirmedNow) data.finishConfirmedAt = at;
  else if (!fields.finishConfirmed) data.finishConfirmedAt = deleteField();

  const batch = writeBatch(db);
  batch.set(workDayRef(uid, date), data, { merge: true });
  if (settings !== null && settings.trackingStartDate === null) {
    batch.set(workSettingsRef(uid), { trackingStartDate: date }, { merge: true });
  }
  await batch.commit();
}

/** Merges `patch` into the Work settings. A `ratesCentsPerHour` map merges key by key. */
export async function saveWorkSettings(uid: string, patch: Partial<WorkSettingsDoc>): Promise<void> {
  await setDoc(workSettingsRef(uid), patch, { merge: true });
}
