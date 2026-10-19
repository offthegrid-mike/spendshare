import { describe, it, expect } from 'vitest';
import type { Timestamp } from 'firebase/firestore';
import type { WorkDayDoc, WorkDayType, WorkSettingsDoc } from '../../types/models';
import type { Clock } from './workDates';
import { DEFAULT_WORK_SETTINGS } from './workSettings';
import { calendarCells } from './workCalendar';

// Monday 19 October 2026, 09:00.
const CLOCK: Clock = { today: '2026-10-19', nowMinutes: 540 };

const SETTINGS: WorkSettingsDoc = { ...DEFAULT_WORK_SETTINGS, trackingStartDate: '2026-10-12' };

// A Home day finishing 16:06 that is counted in the claim and not yet confirmed.
function day(date: string, overrides: Partial<WorkDayDoc> = {}): WorkDayDoc {
  return {
    date,
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
function dayWithoutTimes(date: string, type: Exclude<WorkDayType, 'home'> | null, overrides: Partial<WorkDayDoc> = {}): WorkDayDoc {
  const doc = day(date, { type, countedInClaim: false, ...overrides });
  delete doc.startTime;
  delete doc.finishTime;
  delete doc.minutes;
  return doc;
}

const DAYS = [
  day('2026-10-12', { finishConfirmed: true }),
  dayWithoutTimes('2026-10-13', 'office'),
  dayWithoutTimes('2026-10-14', 'leave'),
];

// Looks up the cell for a date in October 2026.
function cellFor(cells: ReturnType<typeof calendarCells>, date: string) {
  const cell = cells.find((c) => c.date === date);
  if (!cell) throw new Error(`no cell for ${date}`);
  return cell;
}

describe('calendarCells', () => {
  const cells = calendarCells('2026-10', DAYS, SETTINGS, CLOCK);

  it('is whole Monday-first weeks, padded with blank cells', () => {
    expect(cells).toHaveLength(35);
    // 1 October 2026 is a Thursday, so Monday to Wednesday are blank.
    expect(cells.slice(0, 3).map((c) => c.status)).toEqual(['blank', 'blank', 'blank']);
    expect(cells[3]).toMatchObject({ date: '2026-10-01', day: 1 });
    // 31 October is a Saturday, so Sunday is the one trailing blank.
    expect(cells[33]).toMatchObject({ date: '2026-10-31', day: 31 });
    expect(cells[34].status).toBe('blank');
  });

  it('gives a blank cell no date, no day and no flags', () => {
    expect(cells[0]).toEqual({
      date: null,
      day: null,
      status: 'blank',
      today: false,
      late: false,
      unconfirmed: false,
      selectable: false,
    });
  });

  it('marks a day before the tracking start with no record as empty', () => {
    expect(cellFor(cells, '2026-10-01')).toMatchObject({ status: 'empty', selectable: true });
  });

  it('gives a recorded day the status of its type', () => {
    expect(cellFor(cells, '2026-10-12').status).toBe('home');
    expect(cellFor(cells, '2026-10-13').status).toBe('office');
    expect(cellFor(cells, '2026-10-14').status).toBe('leave');
  });

  it('marks a past working day with no record as missing', () => {
    expect(cellFor(cells, '2026-10-15')).toMatchObject({ status: 'missing', selectable: true });
  });

  it('marks a past non-working day with no record as empty, not missing', () => {
    // Saturday 17 October.
    expect(cellFor(cells, '2026-10-17').status).toBe('empty');
  });

  it('marks today with no record as empty, flagged as today', () => {
    expect(cellFor(cells, '2026-10-19')).toMatchObject({ status: 'empty', today: true, selectable: true });
  });

  it('flags only today', () => {
    expect(cells.filter((c) => c.today).map((c) => c.date)).toEqual(['2026-10-19']);
  });

  it('marks a later day as future and not selectable', () => {
    expect(cellFor(cells, '2026-10-20')).toMatchObject({ status: 'future', today: false, selectable: false });
  });

  it('shows a record made for today by its type', () => {
    const withToday = calendarCells('2026-10', [day('2026-10-19')], SETTINGS, CLOCK);
    expect(cellFor(withToday, '2026-10-19')).toMatchObject({ status: 'home', today: true });
  });

  it('flags a recorded day that was added later', () => {
    const late = calendarCells('2026-10', [day('2026-10-14', { addedLater: true })], SETTINGS, CLOCK);
    expect(cellFor(late, '2026-10-14')).toMatchObject({ status: 'home', late: true });
    expect(cellFor(cells, '2026-10-12').late).toBe(false);
  });

  it('flags a past Home day whose finish was never confirmed', () => {
    const unconfirmed = calendarCells('2026-10', [day('2026-10-14')], SETTINGS, CLOCK);
    expect(cellFor(unconfirmed, '2026-10-14').unconfirmed).toBe(true);
    expect(cellFor(cells, '2026-10-12').unconfirmed).toBe(false);
  });

  it('treats a cleared day as not recorded', () => {
    const cleared = calendarCells(
      '2026-10',
      [dayWithoutTimes('2026-10-15', null, { addedLater: true }), dayWithoutTimes('2026-10-01', null)],
      SETTINGS,
      CLOCK,
    );
    expect(cellFor(cleared, '2026-10-15')).toMatchObject({ status: 'missing', late: false, unconfirmed: false });
    expect(cellFor(cleared, '2026-10-01').status).toBe('empty');
  });

  it('marks nothing missing before a tracking start date is set', () => {
    const untracked = calendarCells('2026-10', [], { ...SETTINGS, trackingStartDate: null }, CLOCK);
    expect(untracked.filter((c) => c.status === 'missing')).toEqual([]);
  });

  it('ignores records from other months', () => {
    const other = calendarCells('2026-10', [day('2026-09-30'), day('2026-11-02')], SETTINGS, CLOCK);
    expect(other.filter((c) => c.status === 'home')).toEqual([]);
  });

  it('has no trailing blank when the month ends on a Sunday', () => {
    // May 2026 starts on a Friday (four leading blanks) and ends on Sunday 31 May.
    const may = calendarCells('2026-05', [], SETTINGS, CLOCK);
    expect(may).toHaveLength(35);
    expect(may[34]).toMatchObject({ date: '2026-05-31' });
  });

  it('spans six weeks when the month starts on a Sunday', () => {
    // November 2026 starts on a Sunday: six leading blanks, 30 days, then six trailing.
    const november = calendarCells('2026-11', [], SETTINGS, CLOCK);
    expect(november).toHaveLength(42);
    expect(november.slice(0, 6).every((c) => c.status === 'blank')).toBe(true);
    expect(november[6]).toMatchObject({ date: '2026-11-01' });
  });

  it('handles February in a leap year', () => {
    // February 2028 has 29 days and starts on a Tuesday.
    const feb = calendarCells('2028-02', [], SETTINGS, CLOCK);
    expect(feb.filter((c) => c.date !== null)).toHaveLength(29);
    expect(feb).toHaveLength(35);
    expect(feb[1]).toMatchObject({ date: '2028-02-01' });
    expect(feb.filter((c) => c.date !== null).at(-1)).toMatchObject({ date: '2028-02-29', day: 29 });
  });

  it('has no leading blanks when the month starts on a Monday', () => {
    // February 2027 starts on a Monday and has 28 days: exactly four full weeks.
    const feb = calendarCells('2027-02', [], SETTINGS, CLOCK);
    expect(feb).toHaveLength(28);
    expect(feb[0]).toMatchObject({ date: '2027-02-01', day: 1 });
    expect(feb[27]).toMatchObject({ date: '2027-02-28', day: 28 });
    expect(feb.some((c) => c.status === 'blank')).toBe(false);
  });

  it('wraps the year for December', () => {
    // December 2026 starts on a Tuesday (one leading blank) and has 31 days.
    const dec = calendarCells('2026-12', [], SETTINGS, CLOCK);
    const dated = dec.filter((c) => c.date !== null);
    expect(dated).toHaveLength(31);
    expect(dec[0].status).toBe('blank');
    expect(dec[1]).toMatchObject({ date: '2026-12-01', day: 1 });
    expect(dated.at(-1)).toMatchObject({ date: '2026-12-31', day: 31 });
    expect(dec.length % 7).toBe(0);
  });
});
