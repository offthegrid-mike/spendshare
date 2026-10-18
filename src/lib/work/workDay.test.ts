import { describe, it, expect } from 'vitest';
import type { Timestamp } from 'firebase/firestore';
import type { WorkDayDoc } from '../../types/models';
import { planWorkDayWrite, type WorkAction, type WorkWritePlan } from './workDay';

const DAY = '2026-10-19';
const NEXT = '2026-10-20';

// A Home day saved on the day itself, counted and not yet confirmed.
function day(overrides: Partial<WorkDayDoc> = {}): WorkDayDoc {
  return {
    date: DAY,
    incomeYear: '2026-27',
    type: 'home',
    startTime: '08:30',
    finishTime: '16:06',
    minutes: 456,
    addedLater: false,
    countedInClaim: true,
    finishConfirmed: false,
    firstRecordedAt: {} as Timestamp,
    recordedAt: {} as Timestamp,
    syncedAt: {} as Timestamp,
    revisions: [],
    ...overrides,
  };
}

// A day that carries no times, built without the keys (as Firestore stores it).
function dayWithoutTimes(overrides: Partial<WorkDayDoc> = {}): WorkDayDoc {
  const doc = day({ type: 'office', countedInClaim: false, ...overrides });
  delete doc.startTime;
  delete doc.finishTime;
  delete doc.minutes;
  return doc;
}

function saveHome(times: { startTime?: string; finishTime?: string; minutes?: number } = {}): WorkAction {
  return { kind: 'save', type: 'home', startTime: '08:30', finishTime: '16:06', minutes: 456, ...times };
}

// The fields a plan is allowed to write, taken from an existing document.
function fieldsOf(doc: WorkDayDoc) {
  const { date, incomeYear, type, startTime, finishTime, minutes, addedLater, countedInClaim, finishConfirmed } = doc;
  return { date, incomeYear, type, startTime, finishTime, minutes, addedLater, countedInClaim, finishConfirmed };
}

function plan(date: string, action: WorkAction, existing: WorkDayDoc | null, today: string): WorkWritePlan {
  const result = planWorkDayWrite(date, action, existing, today);
  expect(result).not.toBeNull();
  return result as WorkWritePlan;
}

describe('planWorkDayWrite: save', () => {
  it('records a new Home day on the day, counted and unconfirmed', () => {
    const p = plan(DAY, saveHome(), null, DAY);
    expect(p.fields).toEqual({
      date: DAY,
      incomeYear: '2026-27',
      type: 'home',
      startTime: '08:30',
      finishTime: '16:06',
      minutes: 456,
      addedLater: false,
      countedInClaim: true,
      finishConfirmed: false,
    });
    expect(p).toMatchObject({ isNew: true, changedRecord: true, confirmedNow: false });
    expect(p.revision).toEqual({
      kind: 'save',
      type: 'home',
      startTime: '08:30',
      finishTime: '16:06',
      minutes: 456,
      addedLater: false,
      countedInClaim: true,
      finishConfirmed: false,
    });
  });

  it('takes the income year from the date', () => {
    expect(plan('2026-06-30', saveHome(), null, '2026-06-30').fields.incomeYear).toBe('2025-26');
    expect(plan('2026-07-01', saveHome(), null, '2026-07-01').fields.incomeYear).toBe('2026-27');
  });

  it('marks a day saved the next day as added later and out of the claim', () => {
    const p = plan(DAY, saveHome(), null, NEXT);
    expect(p.fields).toMatchObject({ addedLater: true, countedInClaim: false, finishConfirmed: false });
    expect(p).toMatchObject({ isNew: true, changedRecord: true, confirmedNow: false });
    expect(p.revision).toMatchObject({ kind: 'save', addedLater: true, countedInClaim: false });
  });

  it.each(['office', 'leave'] as const)('keeps no times on a %s day, even when times are supplied', (type) => {
    const p = plan(DAY, { kind: 'save', type, startTime: '08:30', finishTime: '16:06', minutes: 456 }, null, DAY);
    expect(p.fields).toEqual({
      date: DAY,
      incomeYear: '2026-27',
      type,
      addedLater: false,
      countedInClaim: false,
      finishConfirmed: false,
    });
    for (const key of ['startTime', 'finishTime', 'minutes']) {
      expect(key in p.fields).toBe(false);
      expect(key in p.revision).toBe(false);
    }
    expect(p).toMatchObject({ isNew: true, changedRecord: true, confirmedNow: false });
    expect(p.revision.kind).toBe('save');
  });

  it('refuses a day after today', () => {
    expect(() => planWorkDayWrite(NEXT, saveHome(), null, DAY)).toThrow('Cannot record a future day');
    expect(() => planWorkDayWrite(NEXT, { kind: 'save', type: null }, day({ date: NEXT }), DAY)).toThrow(
      'Cannot record a future day',
    );
  });

  it('returns null for a save that changes nothing', () => {
    expect(planWorkDayWrite(DAY, saveHome(), day(), DAY)).toBeNull();
    // Even on a later date, an unchanged save neither flags the day nor takes it out of the claim.
    expect(planWorkDayWrite(DAY, saveHome(), day(), NEXT)).toBeNull();
  });

  it('treats Office as the same record whatever times are supplied', () => {
    const existing = dayWithoutTimes();
    expect(
      planWorkDayWrite(DAY, { kind: 'save', type: 'office', startTime: '09:00', minutes: 100 }, existing, DAY),
    ).toBeNull();
  });

  it('flags an edit of the minutes on the next day, and resets the confirmation', () => {
    const existing = day({ finishConfirmed: true });
    const p = plan(DAY, saveHome({ minutes: 480 }), existing, NEXT);
    expect(p.fields).toEqual({
      date: DAY,
      incomeYear: '2026-27',
      type: 'home',
      startTime: '08:30',
      finishTime: '16:06',
      minutes: 480,
      addedLater: true,
      countedInClaim: false,
      finishConfirmed: false,
    });
    expect(p).toMatchObject({ isNew: false, changedRecord: true, confirmedNow: false });
    expect(p.revision.kind).toBe('save');
  });

  it('keeps an edit of the finish on the same day counted, and resets the confirmation', () => {
    const existing = day({ finishConfirmed: true });
    const p = plan(DAY, saveHome({ finishTime: '16:30' }), existing, DAY);
    expect(p.fields).toMatchObject({
      finishTime: '16:30',
      addedLater: false,
      countedInClaim: true,
      finishConfirmed: false,
    });
    expect(p).toMatchObject({ isNew: false, changedRecord: true, confirmedNow: false });
  });

  it('keeps added later and takes an already-included late day out of the claim when edited', () => {
    const existing = day({ addedLater: true, countedInClaim: true });
    const p = plan(DAY, saveHome({ minutes: 400 }), existing, '2026-10-25');
    expect(p.fields).toMatchObject({ minutes: 400, addedLater: true, countedInClaim: false, finishConfirmed: false });
    expect(p).toMatchObject({ isNew: false, changedRecord: true, confirmedNow: false });
  });

  it('keeps added later when a late day is edited again', () => {
    const existing = day({ addedLater: true, countedInClaim: false });
    expect(plan(DAY, saveHome({ minutes: 400 }), existing, NEXT).fields.addedLater).toBe(true);
  });

  it('clears a day: no type, no times, not counted, not confirmed', () => {
    const existing = day({ finishConfirmed: true });
    const p = plan(DAY, { kind: 'save', type: null }, existing, DAY);
    expect(p.fields).toEqual({
      date: DAY,
      incomeYear: '2026-27',
      type: null,
      addedLater: false,
      countedInClaim: false,
      finishConfirmed: false,
    });
    for (const key of ['startTime', 'finishTime', 'minutes']) {
      expect(key in p.fields).toBe(false);
      expect(key in p.revision).toBe(false);
    }
    expect(p).toMatchObject({ isNew: false, changedRecord: true, confirmedNow: false });
    expect(p.revision).toMatchObject({ kind: 'save', type: null });
  });

  it('returns null when clearing a day that is already cleared, or was never recorded', () => {
    const cleared = dayWithoutTimes({ type: null });
    expect(planWorkDayWrite(DAY, { kind: 'save', type: null }, cleared, DAY)).toBeNull();
    expect(planWorkDayWrite(DAY, { kind: 'save', type: null }, null, DAY)).toBeNull();
  });

  it('drops the times and the confirmation when a Home day becomes Office on the same day', () => {
    const existing = day({ finishConfirmed: true });
    const p = plan(DAY, { kind: 'save', type: 'office' }, existing, DAY);
    expect(p.fields).toEqual({
      date: DAY,
      incomeYear: '2026-27',
      type: 'office',
      addedLater: false,
      countedInClaim: false,
      finishConfirmed: false,
    });
    for (const key of ['startTime', 'finishTime', 'minutes']) {
      expect(key in p.fields).toBe(false);
    }
    expect(p).toMatchObject({ isNew: false, changedRecord: true, confirmedNow: false });
  });
});

describe('planWorkDayWrite: confirm', () => {
  it('confirms a day as it is, changing only the flag', () => {
    const existing = day();
    const p = plan(DAY, { kind: 'confirm' }, existing, DAY);
    expect(p.fields).toEqual({ ...fieldsOf(existing), finishConfirmed: true });
    expect(p).toMatchObject({ isNew: false, changedRecord: false, confirmedNow: true });
    expect(p.revision).toEqual({
      kind: 'confirm',
      type: 'home',
      startTime: '08:30',
      finishTime: '16:06',
      minutes: 456,
      addedLater: false,
      countedInClaim: true,
      finishConfirmed: true,
    });
  });

  it('treats a confirm that repeats the saved finish and minutes as no change', () => {
    const p = plan(DAY, { kind: 'confirm', finishTime: '16:06', minutes: 456 }, day(), DAY);
    expect(p).toMatchObject({ changedRecord: false, confirmedNow: true });
    expect(p.fields).toEqual({ ...fieldsOf(day()), finishConfirmed: true });
  });

  it('confirms with a changed finish on the same day as an edit that ends confirmed', () => {
    const p = plan(DAY, { kind: 'confirm', finishTime: '16:30', minutes: 480 }, day(), DAY);
    expect(p.fields).toEqual({
      date: DAY,
      incomeYear: '2026-27',
      type: 'home',
      startTime: '08:30',
      finishTime: '16:30',
      minutes: 480,
      addedLater: false,
      countedInClaim: true,
      finishConfirmed: true,
    });
    expect(p).toMatchObject({ isNew: false, changedRecord: true, confirmedNow: true });
    expect(p.revision).toMatchObject({ kind: 'confirm', finishTime: '16:30', minutes: 480, finishConfirmed: true });
  });

  it('lets the hours follow when a confirm changes only the finish', () => {
    // 08:30 to 16:30 is 480 minutes, not the 456 the day was saved with.
    const p = plan(DAY, { kind: 'confirm', finishTime: '16:30' }, day(), DAY);
    expect(p.fields).toMatchObject({ startTime: '08:30', finishTime: '16:30', minutes: 480, finishConfirmed: true });
    expect(p.changedRecord).toBe(true);
    expect(p.revision).toMatchObject({ kind: 'confirm', finishTime: '16:30', minutes: 480 });
  });

  it('lets the finish follow when a confirm changes only the hours', () => {
    // 08:30 plus 480 minutes is 16:30.
    const p = plan(DAY, { kind: 'confirm', minutes: 480 }, day(), DAY);
    expect(p.fields).toMatchObject({ startTime: '08:30', finishTime: '16:30', minutes: 480, finishConfirmed: true });
    expect(p).toMatchObject({ changedRecord: true, confirmedNow: true });
    expect(p.revision).toMatchObject({ kind: 'confirm', finishTime: '16:30', minutes: 480 });
  });

  it('keeps the saved start time when a confirm changes the finish', () => {
    const p = plan(DAY, { kind: 'confirm', finishTime: '17:00' }, day({ startTime: '09:15' }), DAY);
    expect(p.fields).toMatchObject({ startTime: '09:15', finishTime: '17:00', minutes: 465 });
  });

  it('refuses a confirm whose finish is before the start', () => {
    expect(() => planWorkDayWrite(DAY, { kind: 'confirm', finishTime: '08:00' }, day(), DAY)).toThrow(
      'Finish must be after start',
    );
  });

  it('refuses a confirm whose finish equals the start', () => {
    expect(() => planWorkDayWrite(DAY, { kind: 'confirm', finishTime: '08:30' }, day(), DAY)).toThrow(
      'Finish must be after start',
    );
  });

  it('refuses a confirm whose finish is not a valid time', () => {
    expect(() => planWorkDayWrite(DAY, { kind: 'confirm', finishTime: '25:00' }, day(), DAY)).toThrow(
      'Finish must be after start',
    );
  });

  it('refuses a confirm whose hours would run past midnight', () => {
    // 08:30 plus 1000 minutes is past 23:59.
    expect(() => planWorkDayWrite(DAY, { kind: 'confirm', minutes: 1000 }, day(), DAY)).toThrow(
      'Hours run past midnight',
    );
    // The last minute of the day is still allowed: 08:30 plus 929 minutes is 23:59.
    expect(plan(DAY, { kind: 'confirm', minutes: 929 }, day(), DAY).fields).toMatchObject({
      finishTime: '23:59',
      minutes: 929,
    });
  });

  it('refuses a confirm whose finish and hours do not agree', () => {
    expect(() =>
      planWorkDayWrite(DAY, { kind: 'confirm', finishTime: '16:30', minutes: 400 }, day(), DAY),
    ).toThrow('Finish and hours do not agree');
    // Even when one of the two matches what is saved.
    expect(() =>
      planWorkDayWrite(DAY, { kind: 'confirm', finishTime: '16:06', minutes: 480 }, day(), DAY),
    ).toThrow('Finish and hours do not agree');
  });

  it('cannot change the finish of a Home day that has no start time', () => {
    const noStart = day();
    delete noStart.startTime;
    expect(() => planWorkDayWrite(DAY, { kind: 'confirm', finishTime: '17:00' }, noStart, DAY)).toThrow(
      'Finish must be after start',
    );
    // Confirming it as it is still works.
    expect(plan(DAY, { kind: 'confirm' }, noStart, DAY).confirmedNow).toBe(true);
  });

  it('treats a confirm that repeats only the saved finish as no change, even if the saved pair disagrees', () => {
    const saved = day({ minutes: 400 }); // 08:30 to 16:06 is 456, but 400 was saved
    const p = plan(DAY, { kind: 'confirm', finishTime: '16:06' }, saved, DAY);
    expect(p).toMatchObject({ changedRecord: false, confirmedNow: true });
    expect(p.fields).toEqual({ ...fieldsOf(saved), finishConfirmed: true });
  });

  it('confirms as it is on a later date, touching only the flag', () => {
    const existing = day({ addedLater: true, countedInClaim: true });
    const p = plan(DAY, { kind: 'confirm' }, existing, '2026-10-25');
    expect(p.fields).toEqual({ ...fieldsOf(existing), finishConfirmed: true });
    expect(p.fields).toMatchObject({ addedLater: true, countedInClaim: true });
    expect(p).toMatchObject({ isNew: false, changedRecord: false, confirmedNow: true });

    // Same on an on-the-day entry confirmed the next day: it stays counted.
    const onTheDay = plan(DAY, { kind: 'confirm' }, day(), NEXT);
    expect(onTheDay.fields).toMatchObject({ addedLater: false, countedInClaim: true, finishConfirmed: true });
  });

  it('treats a confirm with a changed finish on a later date as a late edit that ends confirmed', () => {
    const p = plan(DAY, { kind: 'confirm', finishTime: '16:30', minutes: 480 }, day(), NEXT);
    expect(p.fields).toMatchObject({
      finishTime: '16:30',
      minutes: 480,
      addedLater: true,
      countedInClaim: false,
      finishConfirmed: true,
    });
    expect(p).toMatchObject({ isNew: false, changedRecord: true, confirmedNow: true });
    expect(p.revision.kind).toBe('confirm');
  });

  it('returns null when the day is already confirmed and nothing changes', () => {
    expect(planWorkDayWrite(DAY, { kind: 'confirm' }, day({ finishConfirmed: true }), DAY)).toBeNull();
  });

  it('confirms a changed finish on an already confirmed day', () => {
    const p = plan(DAY, { kind: 'confirm', finishTime: '17:00' }, day({ finishConfirmed: true }), DAY);
    expect(p.fields).toMatchObject({ finishTime: '17:00', finishConfirmed: true });
    expect(p).toMatchObject({ changedRecord: true, confirmedNow: true });
  });

  it('has nothing to confirm on a missing, Office, Leave or cleared day', () => {
    const message = 'Nothing to confirm';
    expect(() => planWorkDayWrite(DAY, { kind: 'confirm' }, null, DAY)).toThrow(message);
    expect(() => planWorkDayWrite(DAY, { kind: 'confirm' }, dayWithoutTimes(), DAY)).toThrow(message);
    expect(() => planWorkDayWrite(DAY, { kind: 'confirm' }, dayWithoutTimes({ type: 'leave' }), DAY)).toThrow(message);
    expect(() => planWorkDayWrite(DAY, { kind: 'confirm' }, dayWithoutTimes({ type: null }), DAY)).toThrow(message);
  });

  it('refuses a changed finish on a day after today', () => {
    expect(() =>
      planWorkDayWrite(NEXT, { kind: 'confirm', finishTime: '17:00' }, day({ date: NEXT }), DAY),
    ).toThrow('Cannot record a future day');
  });
});

describe('planWorkDayWrite: a day whose server timestamp has not come back yet', () => {
  // A write that the server has not acknowledged reads syncedAt as null.
  it('plans from a document with a null syncedAt like any other', () => {
    const pending = day({ syncedAt: null });
    expect(plan(DAY, { kind: 'confirm' }, pending, DAY).fields).toEqual({ ...fieldsOf(pending), finishConfirmed: true });
    expect(planWorkDayWrite(DAY, saveHome(), pending, DAY)).toBeNull();
  });
});

describe('planWorkDayWrite: include and exclude', () => {
  const lateExcluded = () => day({ addedLater: true, countedInClaim: false, finishConfirmed: true });
  const lateIncluded = () => day({ addedLater: true, countedInClaim: true, finishConfirmed: true });

  it('includes a late excluded Home day, changing only countedInClaim', () => {
    const existing = lateExcluded();
    const p = plan(DAY, { kind: 'include' }, existing, '2026-10-25');
    expect(p.fields).toEqual({ ...fieldsOf(existing), countedInClaim: true });
    expect(p).toMatchObject({ isNew: false, changedRecord: false, confirmedNow: false });
    expect(p.revision).toEqual({
      kind: 'include',
      type: 'home',
      startTime: '08:30',
      finishTime: '16:06',
      minutes: 456,
      addedLater: true,
      countedInClaim: true,
      finishConfirmed: true,
    });
  });

  it('returns null for include when already counted, not late, not Home or missing', () => {
    expect(planWorkDayWrite(DAY, { kind: 'include' }, lateIncluded(), NEXT)).toBeNull();
    expect(planWorkDayWrite(DAY, { kind: 'include' }, day({ countedInClaim: false }), NEXT)).toBeNull();
    expect(
      planWorkDayWrite(DAY, { kind: 'include' }, dayWithoutTimes({ addedLater: true, countedInClaim: false }), NEXT),
    ).toBeNull();
    expect(planWorkDayWrite(DAY, { kind: 'include' }, null, NEXT)).toBeNull();
  });

  it('excludes a late included Home day, changing only countedInClaim', () => {
    const existing = lateIncluded();
    const p = plan(DAY, { kind: 'exclude' }, existing, '2026-10-25');
    expect(p.fields).toEqual({ ...fieldsOf(existing), countedInClaim: false });
    expect(p).toMatchObject({ isNew: false, changedRecord: false, confirmedNow: false });
    expect(p.revision).toMatchObject({ kind: 'exclude', addedLater: true, countedInClaim: false });
  });

  it('returns null for exclude on a non-late day, an already excluded day, a non-Home day or a missing day', () => {
    expect(planWorkDayWrite(DAY, { kind: 'exclude' }, day(), DAY)).toBeNull();
    expect(planWorkDayWrite(DAY, { kind: 'exclude' }, lateExcluded(), NEXT)).toBeNull();
    expect(
      planWorkDayWrite(DAY, { kind: 'exclude' }, dayWithoutTimes({ addedLater: true, countedInClaim: true }), NEXT),
    ).toBeNull();
    expect(planWorkDayWrite(DAY, { kind: 'exclude' }, null, NEXT)).toBeNull();
  });

  it('leaves the finish confirmation as it was', () => {
    const unconfirmed = day({ addedLater: true, countedInClaim: false, finishConfirmed: false });
    expect(plan(DAY, { kind: 'include' }, unconfirmed, NEXT).fields.finishConfirmed).toBe(false);
  });
});
