import type { WorkDayDoc, WorkDayType, WorkRevision } from '../../types/models';
import { incomeYearOf } from './workDates';
import { finishFromStart, minutesBetween } from './workTime';

// The pure rules for saving, confirming and including a Work day (spec 7.2a and
// 7.3). It decides what a write should look like and touches no database: the
// writer turns a plan into a Firestore write, so it can add the timestamps and
// delete the optional fields a plan leaves out. Days are local 'YYYY-MM-DD'
// strings, which compare in date order as plain strings, and `today` is passed in.

export type WorkAction =
  | { kind: 'save'; type: WorkDayType | null; startTime?: string; finishTime?: string; minutes?: number }
  | { kind: 'confirm'; finishTime?: string; minutes?: number }
  | { kind: 'include' }
  | { kind: 'exclude' };

export interface WorkDayFields {
  date: string;
  incomeYear: string;
  type: WorkDayType | null;
  startTime?: string;
  finishTime?: string;
  minutes?: number;
  addedLater: boolean;
  countedInClaim: boolean;
  finishConfirmed: boolean;
}

export interface WorkWritePlan {
  fields: WorkDayFields;
  /** No existing document: set firstRecordedAt. */
  isNew: boolean;
  /** The type or times changed: set recordedAt. */
  changedRecord: boolean;
  /** The finish was confirmed by this write: set finishConfirmedAt. */
  confirmedNow: boolean;
  revision: Omit<WorkRevision, 'at'>;
}

type Times = Pick<WorkDayFields, 'startTime' | 'finishTime' | 'minutes'>;

// Copies the times that are set and leaves the others out entirely (no keys with
// undefined values), because the writer turns an absent key into a field deletion.
function presentTimes(times: Times): Times {
  const out: Times = {};
  if (times.startTime !== undefined) out.startTime = times.startTime;
  if (times.finishTime !== undefined) out.finishTime = times.finishTime;
  if (times.minutes !== undefined) out.minutes = times.minutes;
  return out;
}

/** The times a day of this type keeps. Only Home has any. */
function timesFor(type: WorkDayType | null, times: Times): Times {
  return type === 'home' ? presentTimes(times) : {};
}

function sameTimes(a: Times, b: Times): boolean {
  return a.startTime === b.startTime && a.finishTime === b.finishTime && a.minutes === b.minutes;
}

function fieldsOf(doc: WorkDayDoc): WorkDayFields {
  return {
    date: doc.date,
    incomeYear: doc.incomeYear,
    type: doc.type,
    ...timesFor(doc.type, doc),
    addedLater: doc.addedLater,
    countedInClaim: doc.countedInClaim,
    finishConfirmed: doc.finishConfirmed,
  };
}

function revisionOf(kind: WorkRevision['kind'], fields: WorkDayFields): Omit<WorkRevision, 'at'> {
  return {
    kind,
    type: fields.type,
    ...presentTimes(fields),
    addedLater: fields.addedLater,
    countedInClaim: fields.countedInClaim,
    finishConfirmed: fields.finishConfirmed,
  };
}

function assertNotFuture(date: string, today: string): void {
  if (date > today) throw new Error('Cannot record a future day');
}

// A change to the type or times. Made after the day it is added later (and stays
// so), which also takes the day out of the claim until the user includes it
// again. Any change leaves the finish unconfirmed, unless this write confirms it.
function planEdit(
  date: string,
  kind: 'save' | 'confirm',
  type: WorkDayType | null,
  times: Times,
  existing: WorkDayDoc | null,
  today: string,
  confirms: boolean,
): WorkWritePlan {
  const addedLater = (existing?.addedLater ?? false) || today > date;
  const fields: WorkDayFields = {
    date,
    incomeYear: incomeYearOf(date),
    type,
    ...timesFor(type, times),
    addedLater,
    countedInClaim: type === 'home' && !addedLater,
    finishConfirmed: confirms,
  };
  return {
    fields,
    isNew: existing === null,
    changedRecord: true,
    confirmedNow: confirms,
    revision: revisionOf(kind, fields),
  };
}

function planSave(
  date: string,
  action: Extract<WorkAction, { kind: 'save' }>,
  existing: WorkDayDoc | null,
  today: string,
): WorkWritePlan | null {
  assertNotFuture(date, today);
  const times = timesFor(action.type, action);
  const unchanged = existing
    ? existing.type === action.type && sameTimes(timesFor(existing.type, existing), times)
    : action.type === null; // clearing a day that was never recorded has nothing to clear
  if (unchanged) return null;
  return planEdit(date, 'save', action.type, times, existing, today, false);
}

// The finish and hours a confirm saves, for a confirm that carries at least one
// of them. The start is the saved start and never changes, so the finish and the
// hours must agree with it (spec 7.2a: the hours follow): a lone finish gives the
// hours, a lone number of hours gives the finish, and a pair must already agree.
function confirmedTimes(
  startTime: string | undefined,
  finishTime: string | undefined,
  minutes: number | undefined,
): { finishTime: string; minutes: number } {
  const start = startTime ?? ''; // a missing start parses as invalid, so it fails below
  if (finishTime !== undefined && minutes !== undefined) {
    if (minutesBetween(start, finishTime) !== minutes) throw new Error('Finish and hours do not agree');
    return { finishTime, minutes };
  }
  if (finishTime !== undefined) {
    const derived = minutesBetween(start, finishTime);
    if (derived === null) throw new Error('Finish must be after start');
    return { finishTime, minutes: derived };
  }
  if (minutes !== undefined) {
    const derived = finishFromStart(start, minutes);
    if (derived === null) throw new Error('Hours run past midnight');
    return { finishTime: derived, minutes };
  }
  // planConfirm only asks when the action carries a finish or hours.
  throw new Error('Nothing to change');
}

function planConfirm(
  date: string,
  action: Extract<WorkAction, { kind: 'confirm' }>,
  existing: WorkDayDoc | null,
  today: string,
): WorkWritePlan | null {
  if (!existing || existing.type !== 'home') throw new Error('Nothing to confirm');
  const finishChanged = action.finishTime !== undefined && action.finishTime !== existing.finishTime;
  const minutesChanged = action.minutes !== undefined && action.minutes !== existing.minutes;
  if (finishChanged || minutesChanged) {
    // Changing the finish or hours is an edit, judged like a save of the new times, that ends confirmed.
    assertNotFuture(date, today);
    const { finishTime, minutes } = confirmedTimes(existing.startTime, action.finishTime, action.minutes);
    const times = { startTime: existing.startTime, finishTime, minutes };
    return planEdit(date, 'confirm', 'home', times, existing, today, true);
  }
  if (existing.finishConfirmed) return null;
  const fields: WorkDayFields = { ...fieldsOf(existing), finishConfirmed: true };
  return {
    fields,
    isNew: false,
    changedRecord: false,
    confirmedNow: true,
    revision: revisionOf('confirm', fields),
  };
}

// Include and exclude only switch countedInClaim, and only on a late Home day.
function planInclusion(kind: 'include' | 'exclude', existing: WorkDayDoc | null): WorkWritePlan | null {
  if (!existing || existing.type !== 'home' || !existing.addedLater) return null;
  const countedInClaim = kind === 'include';
  if (existing.countedInClaim === countedInClaim) return null;
  const fields: WorkDayFields = { ...fieldsOf(existing), countedInClaim };
  return {
    fields,
    isNew: false,
    changedRecord: false,
    confirmedNow: false,
    revision: revisionOf(kind, fields),
  };
}

/**
 * What writing `action` to `date` should look like, given the day's existing
 * document (null if none) and today's local date. Null means there is nothing to
 * write. Throws for a save on a future day, for a confirm on anything but an
 * existing Home day, and for a confirm whose finish or hours cannot go with the
 * saved start ('Finish must be after start', 'Hours run past midnight', 'Finish
 * and hours do not agree').
 */
export function planWorkDayWrite(
  date: string,
  action: WorkAction,
  existing: WorkDayDoc | null,
  today: string,
): WorkWritePlan | null {
  switch (action.kind) {
    case 'save':
      return planSave(date, action, existing, today);
    case 'confirm':
      return planConfirm(date, action, existing, today);
    case 'include':
    case 'exclude':
      return planInclusion(action.kind, existing);
  }
}
