import { describe, it, expect } from 'vitest';
import type { Timestamp } from 'firebase/firestore';
import type { WorkDayDoc, WorkDayType, WorkSettingsDoc } from '../../types/models';
import { recentWorkingDays, todayStatus } from './workRecent';

const stamp = { toDate: () => new Date('2026-10-19T08:00:00Z') } as unknown as Timestamp;

function day(date: string, type: WorkDayType | null, minutes?: number): WorkDayDoc {
  return {
    date,
    incomeYear: '2026-27',
    type,
    ...(minutes !== undefined ? { startTime: '08:30', finishTime: '16:06', minutes } : {}),
    addedLater: false,
    countedInClaim: type === 'home',
    finishConfirmed: false,
    firstRecordedAt: stamp,
    recordedAt: stamp,
    syncedAt: stamp,
    revisions: [],
  };
}

const SETTINGS: WorkSettingsDoc = {
  workWeekdays: [1, 2, 3, 4, 5],
  defaultMinutes: 456,
  ratesCentsPerHour: {},
  trackingStartDate: '2026-10-12',
};

const MONDAY = { today: '2026-10-19', nowMinutes: 540 };
const SUNDAY = { today: '2026-10-18', nowMinutes: 540 };

describe('recentWorkingDays', () => {
  it('gives the last five work weekdays up to today, oldest first', () => {
    const recent = recentWorkingDays([day('2026-10-13', 'office'), day('2026-10-14', 'office')], SETTINGS, MONDAY);
    expect(recent.map((d) => d.date)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-19']);
    expect(recent.map((d) => d.status)).toEqual(['office', 'office', 'missing', 'missing', 'unrecorded']);
    expect(recent.map((d) => d.isToday)).toEqual([false, false, false, false, true]);
  });

  it('shows each recorded type', () => {
    const days = [day('2026-10-15', 'home', 456), day('2026-10-16', 'leave'), day('2026-10-19', 'home', 456)];
    expect(recentWorkingDays(days, SETTINGS, MONDAY).map((d) => d.status)).toEqual([
      'missing',
      'missing',
      'home',
      'leave',
      'home',
    ]);
  });

  it('treats a cleared day as not recorded', () => {
    const recent = recentWorkingDays([day('2026-10-15', null), day('2026-10-19', null)], SETTINGS, MONDAY);
    expect(recent[2].status).toBe('missing');
    expect(recent[4].status).toBe('unrecorded');
  });

  it('on a weekend ends with the last work day, and none is today', () => {
    const recent = recentWorkingDays([], SETTINGS, SUNDAY);
    expect(recent.map((d) => d.date)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16']);
    expect(recent.some((d) => d.isToday)).toBe(false);
  });

  it('shows a day before the tracking start as none, not missing', () => {
    const recent = recentWorkingDays([], { ...SETTINGS, trackingStartDate: '2026-10-15' }, MONDAY);
    expect(recent.map((d) => d.status)).toEqual(['none', 'none', 'missing', 'missing', 'unrecorded']);
  });

  it('shows nothing as missing without a tracking start date', () => {
    const recent = recentWorkingDays([], { ...SETTINGS, trackingStartDate: null }, MONDAY);
    expect(recent.map((d) => d.status)).toEqual(['none', 'none', 'none', 'none', 'unrecorded']);
  });

  it('shows days before the income year as none, as the tile has not loaded them', () => {
    const recent = recentWorkingDays([], { ...SETTINGS, trackingStartDate: '2026-05-01' }, {
      today: '2026-07-02',
      nowMinutes: 540,
    });
    expect(recent.map((d) => d.date)).toEqual(['2026-06-26', '2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02']);
    expect(recent.map((d) => d.status)).toEqual(['none', 'none', 'none', 'missing', 'unrecorded']);
  });

  it('skips the weekdays that are not work days', () => {
    const recent = recentWorkingDays([], { ...SETTINGS, workWeekdays: [1, 2, 3] }, MONDAY);
    expect(recent.map((d) => d.date)).toEqual(['2026-10-07', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-19']);
  });

  it('looks back no more than 21 days', () => {
    expect(recentWorkingDays([], { ...SETTINGS, workWeekdays: [] }, MONDAY)).toEqual([]);
    // Only Sundays: 18 Oct, 11 Oct and 4 Oct are within 21 days of Monday 19 Oct, 27 Sep is not.
    const sundays = recentWorkingDays([], { ...SETTINGS, workWeekdays: [7] }, MONDAY);
    expect(sundays.map((d) => d.date)).toEqual(['2026-10-04', '2026-10-11', '2026-10-18']);
  });

  it('takes a different count', () => {
    expect(recentWorkingDays([], SETTINGS, MONDAY, 2).map((d) => d.date)).toEqual(['2026-10-16', '2026-10-19']);
  });
});

describe('todayStatus', () => {
  it('gives a recorded Home day with its minutes', () => {
    expect(todayStatus([day('2026-10-19', 'home', 456)], SETTINGS, MONDAY)).toEqual({
      kind: 'recorded',
      type: 'home',
      minutes: 456,
    });
  });

  it('gives a recorded Office day without minutes', () => {
    expect(todayStatus([day('2026-10-19', 'office')], SETTINGS, MONDAY)).toEqual({ kind: 'recorded', type: 'office' });
  });

  it('gives a work weekday with no record, or a cleared one, as unrecorded', () => {
    expect(todayStatus([], SETTINGS, MONDAY)).toEqual({ kind: 'unrecorded' });
    expect(todayStatus([day('2026-10-19', null)], SETTINGS, MONDAY)).toEqual({ kind: 'unrecorded' });
  });

  it('gives a day off with no record as an off day', () => {
    expect(todayStatus([], SETTINGS, SUNDAY)).toEqual({ kind: 'offday' });
  });

  it('gives a day off with a record as recorded', () => {
    expect(todayStatus([day('2026-10-18', 'home', 120)], SETTINGS, SUNDAY)).toEqual({
      kind: 'recorded',
      type: 'home',
      minutes: 120,
    });
  });
});
