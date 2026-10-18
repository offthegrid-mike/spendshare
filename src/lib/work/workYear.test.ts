import { describe, it, expect } from 'vitest';
import type { Timestamp } from 'firebase/firestore';
import type { WorkDayDoc } from '../../types/models';
import type { Clock } from './workDates';
import { claimCentsFor, isFinishPassed, isUnconfirmed, monthlyTotals, summariseYear } from './workYear';

const CLOCK: Clock = { today: '2026-10-19', nowMinutes: 540 };

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

describe('claimCentsFor', () => {
  it('multiplies minutes by the hourly rate in cents and drops the fraction of a cent', () => {
    expect(claimCentsFor(10944, 70)).toBe(12768);
    expect(claimCentsFor(1, 70)).toBe(1);
    expect(claimCentsFor(0, 70)).toBe(0);
  });

  it('drops cents rather than rounding them', () => {
    // 59 min at 70c/h is 68.83 cents, which rounds up to 69 but is 68 once dropped.
    expect(claimCentsFor(59, 70)).toBe(68);
  });
});

describe('isFinishPassed', () => {
  it('is true for a day before today', () => {
    expect(isFinishPassed(day({ date: '2026-10-18' }), CLOCK)).toBe(true);
  });

  it('is true on the day itself once the finish minute has been reached, and false before it', () => {
    const today = day({ date: '2026-10-19', finishTime: '16:06' }); // 16:06 is minute 966
    expect(isFinishPassed(today, { today: '2026-10-19', nowMinutes: 970 })).toBe(true);
    expect(isFinishPassed(today, { today: '2026-10-19', nowMinutes: 960 })).toBe(false);
    expect(isFinishPassed(today, { today: '2026-10-19', nowMinutes: 966 })).toBe(true);
  });

  it('is false for a later day', () => {
    expect(isFinishPassed(day({ date: '2026-10-20' }), CLOCK)).toBe(false);
  });

  it('is false for a day without a finish time', () => {
    const doc = day({ date: '2026-10-18' });
    delete doc.finishTime;
    expect(isFinishPassed(doc, CLOCK)).toBe(false);
  });

  it('is false for a finish time that does not parse', () => {
    expect(isFinishPassed(day({ date: '2026-10-18', finishTime: '4pm' }), CLOCK)).toBe(false);
  });
});

describe('isUnconfirmed', () => {
  it('is true for a Home day whose finish has passed and is not confirmed', () => {
    expect(isUnconfirmed(day({ date: '2026-10-18' }), CLOCK)).toBe(true);
  });

  it('is false once the finish is confirmed', () => {
    expect(isUnconfirmed(day({ date: '2026-10-18', finishConfirmed: true }), CLOCK)).toBe(false);
  });

  it('is false while the finish has not passed', () => {
    expect(isUnconfirmed(day({ date: '2026-10-19' }), CLOCK)).toBe(false);
  });

  it('is false for an Office day', () => {
    expect(isUnconfirmed(dayWithoutTimes('office', '2026-10-18'), CLOCK)).toBe(false);
  });

  it('is false for a cleared day', () => {
    expect(isUnconfirmed(dayWithoutTimes(null, '2026-10-18'), CLOCK)).toBe(false);
  });
});

describe('summariseYear', () => {
  // A counted and confirmed; B counted and unconfirmed; C late and excluded;
  // D late and included, unconfirmed; E Office; F Leave; G cleared.
  const days = [
    day({ date: '2026-10-01', finishConfirmed: true }),
    day({ date: '2026-10-02' }),
    day({ date: '2026-10-05', addedLater: true, countedInClaim: false }),
    day({ date: '2026-10-06', addedLater: true, countedInClaim: true }),
    dayWithoutTimes('office', '2026-10-07'),
    dayWithoutTimes('leave', '2026-10-08'),
    dayWithoutTimes(null, '2026-10-09'),
  ];

  it('tallies counted, added later, not confirmed, Office and Leave days and works out the claim', () => {
    expect(summariseYear(days, 70, CLOCK)).toEqual({
      counted: { days: 3, minutes: 1368 },
      addedLater: { days: 1, minutes: 456 },
      notConfirmed: { days: 2, minutes: 912 },
      officeDays: 1,
      leaveDays: 1,
      claimCents: 1596,
      claimDollars: 15,
    });
  });

  it('is all zero for no days', () => {
    expect(summariseYear([], 70, CLOCK)).toEqual({
      counted: { days: 0, minutes: 0 },
      addedLater: { days: 0, minutes: 0 },
      notConfirmed: { days: 0, minutes: 0 },
      officeDays: 0,
      leaveDays: 0,
      claimCents: 0,
      claimDollars: 0,
    });
  });

  it('works out the claim from the counted minutes only, dropping cents', () => {
    // 10944 minutes (24 standard days) at 70c/h is 12768 cents: $127, with 68c dropped.
    const many = Array.from({ length: 24 }, (_, i) =>
      day({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, finishConfirmed: true }),
    );
    const summary = summariseYear([...many, day({ date: '2026-09-28', addedLater: true, countedInClaim: false })], 70, CLOCK);
    expect(summary.counted).toEqual({ days: 24, minutes: 10944 });
    expect(summary.claimCents).toBe(12768);
    expect(summary.claimDollars).toBe(127);
  });

  it('counts a Home day without minutes as a day of zero minutes', () => {
    const noMinutes = day({ date: '2026-10-03', finishConfirmed: true });
    delete noMinutes.minutes;
    const summary = summariseYear([noMinutes], 70, CLOCK);
    expect(summary.counted).toEqual({ days: 1, minutes: 0 });
    expect(summary.claimCents).toBe(0);
  });

  it('counts Office and Leave days whether or not they were added later, and ignores cleared days', () => {
    const summary = summariseYear(
      [
        dayWithoutTimes('office', '2026-10-01', { addedLater: true }),
        dayWithoutTimes('leave', '2026-10-02', { addedLater: true }),
        dayWithoutTimes(null, '2026-10-03', { addedLater: true }),
      ],
      70,
      CLOCK,
    );
    expect(summary.officeDays).toBe(1);
    expect(summary.leaveDays).toBe(1);
    expect(summary.counted).toEqual({ days: 0, minutes: 0 });
    expect(summary.addedLater).toEqual({ days: 0, minutes: 0 });
  });

  it('does not count an unconfirmed day that is not in the claim as not confirmed', () => {
    const summary = summariseYear([day({ date: '2026-10-05', addedLater: true, countedInClaim: false })], 70, CLOCK);
    expect(summary.notConfirmed).toEqual({ days: 0, minutes: 0 });
    expect(summary.addedLater).toEqual({ days: 1, minutes: 456 });
  });

  it('does not change the days it is given', () => {
    const copy = structuredClone(days);
    summariseYear(days, 70, CLOCK);
    expect(days).toEqual(copy);
  });
});

describe('monthlyTotals', () => {
  it('groups days by month, ascending, with Home, counted, Office and Leave totals', () => {
    const days = [
      day({ date: '2026-11-03' }),
      day({ date: '2026-10-02' }),
      day({ date: '2026-10-05', minutes: 300, addedLater: true, countedInClaim: false }),
      dayWithoutTimes('office', '2026-10-06'),
      dayWithoutTimes('leave', '2026-11-04'),
      dayWithoutTimes('office', '2026-11-05'),
      dayWithoutTimes('office', '2026-10-07', { addedLater: true }),
    ];
    expect(monthlyTotals(days)).toEqual([
      { month: '2026-10', homeDays: 2, countedMinutes: 456, officeDays: 2, leaveDays: 0 },
      { month: '2026-11', homeDays: 1, countedMinutes: 456, officeDays: 1, leaveDays: 1 },
    ]);
  });

  it('omits months with no recorded day, including months with only cleared days', () => {
    const days = [
      day({ date: '2026-10-02' }),
      dayWithoutTimes(null, '2026-11-02'),
      day({ date: '2026-12-01' }),
    ];
    expect(monthlyTotals(days).map((m) => m.month)).toEqual(['2026-10', '2026-12']);
  });

  it('sums minutes of counted Home days only and treats missing minutes as zero', () => {
    const noMinutes = day({ date: '2026-10-03' });
    delete noMinutes.minutes;
    const [october] = monthlyTotals([
      day({ date: '2026-10-01', minutes: 400 }),
      day({ date: '2026-10-02', minutes: 100, addedLater: true, countedInClaim: false }),
      noMinutes,
    ]);
    expect(october).toEqual({ month: '2026-10', homeDays: 3, countedMinutes: 400, officeDays: 0, leaveDays: 0 });
  });

  it('is empty for no days and does not change the days it is given', () => {
    expect(monthlyTotals([])).toEqual([]);
    const days = [day({ date: '2026-11-03' }), day({ date: '2026-10-02' })];
    const copy = structuredClone(days);
    monthlyTotals(days);
    expect(days).toEqual(copy);
  });
});
