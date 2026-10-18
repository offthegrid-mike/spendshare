import { describe, it, expect } from 'vitest';
import type { Timestamp } from 'firebase/firestore';
import type { WorkDayDoc, WorkSettingsDoc } from '../../types/models';
import type { Clock } from './workDates';
import { DEFAULT_WORK_SETTINGS } from './workSettings';
import { isMissingDay, missingDates, toConfirmDates } from './workLists';

// Monday 19 October 2026, 09:00.
const CLOCK: Clock = { today: '2026-10-19', nowMinutes: 540 };

function settings(overrides: Partial<WorkSettingsDoc> = {}): WorkSettingsDoc {
  return { ...DEFAULT_WORK_SETTINGS, trackingStartDate: '2026-10-12', ...overrides };
}

// A Home day that is counted in the claim and not yet confirmed, finishing 16:06.
function day(overrides: Partial<WorkDayDoc> = {}): WorkDayDoc {
  return {
    date: '2026-10-12',
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

// An Office, Leave or cleared day: no times and not in the claim, as Firestore stores it.
function dayWithoutTimes(type: 'office' | 'leave' | null, date: string, overrides: Partial<WorkDayDoc> = {}): WorkDayDoc {
  const doc = day({ type, date, countedInClaim: false, ...overrides });
  delete doc.startTime;
  delete doc.finishTime;
  delete doc.minutes;
  return doc;
}

describe('isMissingDay', () => {
  it('is true for a past working weekday with no record, on or after the tracking start', () => {
    expect(isMissingDay('2026-10-15', undefined, settings(), CLOCK)).toBe(true);
  });

  it('is true on the tracking start date itself', () => {
    expect(isMissingDay('2026-10-12', undefined, settings(), CLOCK)).toBe(true);
  });

  it('is false for today, which is not over yet', () => {
    expect(isMissingDay('2026-10-19', undefined, settings(), CLOCK)).toBe(false);
  });

  it('is false for a later day', () => {
    expect(isMissingDay('2026-10-20', undefined, settings(), CLOCK)).toBe(false);
  });

  it('is false for a weekend day, which is not a working weekday', () => {
    expect(isMissingDay('2026-10-17', undefined, settings(), CLOCK)).toBe(false);
  });

  it('is false for a day before the tracking start date', () => {
    expect(isMissingDay('2026-10-11', undefined, settings(), CLOCK)).toBe(false);
    expect(isMissingDay('2026-10-09', undefined, settings(), CLOCK)).toBe(false);
  });

  it('is false for a recorded day of any type', () => {
    expect(isMissingDay('2026-10-15', day({ date: '2026-10-15' }), settings(), CLOCK)).toBe(false);
    expect(isMissingDay('2026-10-15', dayWithoutTimes('office', '2026-10-15'), settings(), CLOCK)).toBe(false);
    expect(isMissingDay('2026-10-15', dayWithoutTimes('leave', '2026-10-15'), settings(), CLOCK)).toBe(false);
  });

  it('is true for a document whose type was cleared to null', () => {
    expect(isMissingDay('2026-10-15', dayWithoutTimes(null, '2026-10-15'), settings(), CLOCK)).toBe(true);
  });

  it('is false whenever there is no tracking start date', () => {
    expect(isMissingDay('2026-10-15', undefined, settings({ trackingStartDate: null }), CLOCK)).toBe(false);
  });

  it('follows the working weekdays in the settings', () => {
    const midweek = settings({ workWeekdays: [1, 2, 3] });
    expect(isMissingDay('2026-10-14', undefined, midweek, CLOCK)).toBe(true); // Wednesday
    expect(isMissingDay('2026-10-15', undefined, midweek, CLOCK)).toBe(false); // Thursday
    const saturdays = settings({ workWeekdays: [6] });
    expect(isMissingDay('2026-10-17', undefined, saturdays, CLOCK)).toBe(true);
    expect(isMissingDay('2026-10-16', undefined, saturdays, CLOCK)).toBe(false);
  });
});

describe('missingDates', () => {
  it('is empty when there is no tracking start date', () => {
    expect(missingDates([], settings({ trackingStartDate: null }), CLOCK)).toEqual([]);
  });

  it('lists past working weekdays with no record, ascending, leaving out weekends and today', () => {
    const days = [
      day({ date: '2026-10-12' }),
      day({ date: '2026-10-13' }),
      dayWithoutTimes('office', '2026-10-14'),
    ];
    expect(missingDates(days, settings(), CLOCK)).toEqual(['2026-10-15', '2026-10-16']);
  });

  it('counts a document with a null type as missing', () => {
    const days = [
      day({ date: '2026-10-12' }),
      dayWithoutTimes(null, '2026-10-13'),
      day({ date: '2026-10-14' }),
      day({ date: '2026-10-15' }),
      day({ date: '2026-10-16' }),
    ];
    expect(missingDates(days, settings(), CLOCK)).toEqual(['2026-10-13']);
  });

  it('is empty when every working day so far is recorded', () => {
    const days = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'].map((date) => day({ date }));
    expect(missingDates(days, settings(), CLOCK)).toEqual([]);
  });

  it('looks only at the current income year, however early the tracking start is', () => {
    const clock: Clock = { today: '2026-07-03', nowMinutes: 540 };
    expect(missingDates([], settings({ trackingStartDate: '2026-05-01' }), clock)).toEqual(['2026-07-01', '2026-07-02']);
  });

  it('starts at the tracking start when that is later than the income year start', () => {
    const clock: Clock = { today: '2026-07-03', nowMinutes: 540 };
    expect(missingDates([], settings({ trackingStartDate: '2026-07-02' }), clock)).toEqual(['2026-07-02']);
  });

  it('is empty on the first day of an income year, whatever came before it', () => {
    const clock: Clock = { today: '2026-07-01', nowMinutes: 540 };
    expect(missingDates([], settings({ trackingStartDate: '2026-05-01' }), clock)).toEqual([]);
  });

  it('still lists the last days of an income year on its final day', () => {
    const clock: Clock = { today: '2026-06-30', nowMinutes: 540 };
    // 29 June 2026 is a Monday, in 2025-26.
    expect(missingDates([], settings({ trackingStartDate: '2026-06-29' }), clock)).toEqual(['2026-06-29']);
  });

  it('only lists the working weekdays in the settings', () => {
    expect(missingDates([], settings({ workWeekdays: [1, 2, 3] }), CLOCK)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14']);
  });

  it('is empty when the tracking start date is after today', () => {
    expect(missingDates([], settings({ trackingStartDate: '2026-10-26' }), CLOCK)).toEqual([]);
  });

  it('is empty when the tracking start date is today', () => {
    expect(missingDates([], settings({ trackingStartDate: '2026-10-19' }), CLOCK)).toEqual([]);
  });

  it('is empty when no weekdays are worked', () => {
    expect(missingDates([], settings({ workWeekdays: [] }), CLOCK)).toEqual([]);
  });

  it('does not change the days it is given', () => {
    const days = [day({ date: '2026-10-13' }), day({ date: '2026-10-12' })];
    const copy = structuredClone(days);
    missingDates(days, settings(), CLOCK);
    expect(days).toEqual(copy);
  });
});

describe('toConfirmDates', () => {
  it('lists an unconfirmed Home day in the past', () => {
    expect(toConfirmDates([day({ date: '2026-10-16' })], CLOCK)).toEqual(['2026-10-16']);
  });

  it("lists today's Home day only once its finish has passed", () => {
    const today = day({ date: '2026-10-19', finishTime: '16:06' }); // 16:06 is minute 966
    expect(toConfirmDates([today], { today: '2026-10-19', nowMinutes: 960 })).toEqual([]);
    expect(toConfirmDates([today], { today: '2026-10-19', nowMinutes: 966 })).toEqual(['2026-10-19']);
    expect(toConfirmDates([today], { today: '2026-10-19', nowMinutes: 1000 })).toEqual(['2026-10-19']);
  });

  it('leaves out confirmed days, Office days, Leave days and cleared days', () => {
    const days = [
      day({ date: '2026-10-12', finishConfirmed: true }),
      dayWithoutTimes('office', '2026-10-13'),
      dayWithoutTimes('leave', '2026-10-14'),
      dayWithoutTimes(null, '2026-10-15'),
      day({ date: '2026-10-16' }),
    ];
    expect(toConfirmDates(days, CLOCK)).toEqual(['2026-10-16']);
  });

  it('lists the days in ascending date order', () => {
    const days = [day({ date: '2026-10-16' }), day({ date: '2026-10-02' }), day({ date: '2026-10-09' })];
    expect(toConfirmDates(days, CLOCK)).toEqual(['2026-10-02', '2026-10-09', '2026-10-16']);
  });

  it('is empty for no days and does not change the days it is given', () => {
    expect(toConfirmDates([], CLOCK)).toEqual([]);
    const days = [day({ date: '2026-10-16' }), day({ date: '2026-10-02' })];
    const copy = structuredClone(days);
    toConfirmDates(days, CLOCK);
    expect(days).toEqual(copy);
  });
});
