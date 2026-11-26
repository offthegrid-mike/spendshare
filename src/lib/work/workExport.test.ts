import { describe, it, expect } from 'vitest';
import type { Timestamp } from 'firebase/firestore';
import type { WorkDayDoc, WorkRevision } from '../../types/models';
import type { ResolvedRate } from './workRates';
import { summariseYear } from './workYear';
import { DAYS_HEADER, daysCsv, exportFileName, revisionsCsv } from './workExport';

const ISO = '2026-10-19T08:00:00.000Z';
const at = (iso = ISO) => ({ toDate: () => new Date(iso) }) as unknown as Timestamp;

const CLOCK = { today: '2026-10-19', nowMinutes: 540 };
const CARRIED: ResolvedRate = { cents: 70, source: 'carried', carriedFrom: '2025-26' };

function revision(kind: WorkRevision['kind'], extra: Partial<WorkRevision> = {}): WorkRevision {
  return {
    at: at(),
    kind,
    type: 'home',
    startTime: '08:30',
    finishTime: '16:06',
    minutes: 456,
    addedLater: false,
    countedInClaim: true,
    finishConfirmed: false,
    ...extra,
  };
}

function day(date: string, extra: Partial<WorkDayDoc> = {}): WorkDayDoc {
  return {
    date,
    incomeYear: '2026-27',
    type: 'home',
    startTime: '08:30',
    finishTime: '16:06',
    minutes: 456,
    addedLater: false,
    countedInClaim: true,
    finishConfirmed: true,
    finishConfirmedAt: at(),
    firstRecordedAt: at(),
    recordedAt: at(),
    syncedAt: at(),
    revisions: [revision('save')],
    ...extra,
  };
}

const HOME = day('2026-10-14');
const LATE = day('2026-10-13', {
  addedLater: true,
  countedInClaim: false,
  finishConfirmed: false,
  finishConfirmedAt: undefined,
  revisions: [revision('save', { addedLater: true, countedInClaim: false })],
});
const OFFICE = day('2026-10-15', {
  type: 'office',
  startTime: undefined,
  finishTime: undefined,
  minutes: undefined,
  countedInClaim: false,
  finishConfirmed: false,
  finishConfirmedAt: undefined,
  revisions: [revision('save', { type: 'office', startTime: undefined, finishTime: undefined, minutes: undefined })],
});

// The fixtures contain no commas, so a plain split reads a line's cells.
function rows(csv: string): Record<string, string>[] {
  const lines = csv.split('\n');
  const end = lines.indexOf('');
  return lines.slice(1, end).map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(DAYS_HEADER.map((name, i) => [name, cells[i]]));
  });
}

function summaryLines(csv: string): string[] {
  const lines = csv.split('\n');
  return lines.slice(lines.indexOf('') + 1).filter((line) => line !== '');
}

describe('daysCsv', () => {
  const csv = daysCsv([OFFICE, HOME, LATE], '2026-27', CARRIED, CLOCK);

  it('starts with the header', () => {
    expect(csv.split('\n')[0]).toBe(DAYS_HEADER.join(','));
    expect(DAYS_HEADER.join(',')).toBe(
      'date,weekday,type,start,finish,minutes,hours,first_recorded_at,last_saved_at,synced_at,added_later,counted_in_claim,finish_confirmed,confirmed_at,revisions',
    );
  });

  it('lists the days ascending by date', () => {
    expect(rows(csv).map((row) => row.date)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15']);
  });

  it('writes a Home day with its times, hours and flags', () => {
    const home = rows(csv)[1];
    expect(home).toMatchObject({
      weekday: 'Wed',
      type: 'home',
      start: '08:30',
      finish: '16:06',
      minutes: '456',
      hours: '7.6',
      first_recorded_at: ISO,
      last_saved_at: ISO,
      synced_at: ISO,
      added_later: 'no',
      counted_in_claim: 'yes',
      finish_confirmed: 'yes',
      confirmed_at: ISO,
      revisions: '1',
    });
  });

  it('marks a late day as added later and not counted', () => {
    const late = rows(csv)[0];
    expect(late).toMatchObject({ added_later: 'yes', counted_in_claim: 'no', finish_confirmed: 'no', confirmed_at: '' });
  });

  it('leaves the times and hours of an Office day empty', () => {
    const office = rows(csv)[2];
    expect(office).toMatchObject({ type: 'office', start: '', finish: '', minutes: '', hours: '' });
  });

  it('ends with the summary block', () => {
    const summary = summariseYear([OFFICE, HOME, LATE], CARRIED.cents, CLOCK);
    expect(summaryLines(csv)).toEqual([
      'Income year,2026-27',
      'Counted home days,1',
      'Counted home hours,7.6',
      'Not confirmed hours (still counted),0.0',
      'Added later hours (not counted),7.6',
      'Rate (cents per hour),70',
      'Rate source,carried from 2025-26',
      'Claim before dropping cents,5.32',
      `Claim (cents dropped),${summary.claimDollars}`,
    ]);
  });

  it('ends every line with a newline', () => {
    expect(csv.endsWith('\n')).toBe(true);
    expect(csv).not.toContain('\r');
  });

  it('prints an empty synced_at for a write the server has not acknowledged', () => {
    const pending = day('2026-10-14', { syncedAt: null });
    expect(rows(daysCsv([pending], '2026-27', CARRIED, CLOCK))[0].synced_at).toBe('');
  });

  it('leaves the type empty for a cleared day', () => {
    const cleared = day('2026-10-14', { type: null, startTime: undefined, finishTime: undefined, minutes: undefined });
    expect(rows(daysCsv([cleared], '2026-27', CARRIED, CLOCK))[0]).toMatchObject({ type: '', hours: '' });
  });

  it('exports an empty year as the header, a blank line and zero totals', () => {
    const empty = daysCsv([], '2026-27', { cents: 70, source: 'known' }, CLOCK);
    const lines = empty.split('\n');
    expect(lines[0]).toBe(DAYS_HEADER.join(','));
    expect(lines[1]).toBe('');
    expect(summaryLines(empty)).toEqual([
      'Income year,2026-27',
      'Counted home days,0',
      'Counted home hours,0.0',
      'Not confirmed hours (still counted),0.0',
      'Added later hours (not counted),0.0',
      'Rate (cents per hour),70',
      'Rate source,known',
      'Claim before dropping cents,0.00',
      'Claim (cents dropped),0',
    ]);
  });

  it('names a rate the user set', () => {
    const set = daysCsv([], '2026-27', { cents: 75, source: 'set' }, CLOCK);
    expect(summaryLines(set)).toContain('Rate source,set');
  });

  it('shows the claim before dropping cents to two decimals', () => {
    // 22 days of 7.6 h at 70c/h: 11 704 cents.
    const days = Array.from({ length: 22 }, (_, i) => day(`2026-08-${String(i + 1).padStart(2, '0')}`));
    const lines = summaryLines(daysCsv(days, '2026-27', CARRIED, CLOCK));
    expect(lines).toContain('Claim before dropping cents,117.04');
    expect(lines).toContain('Claim (cents dropped),117');
  });
});

describe('revisionsCsv', () => {
  it('lists every revision, by date then revision order', () => {
    const twice = day('2026-10-14', {
      revisions: [revision('save'), revision('confirm', { finishConfirmed: true, at: at('2026-10-14T06:06:00.000Z') })],
    });
    const csv = revisionsCsv([OFFICE, twice]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('date,revised_at,kind,type,start,finish,minutes,added_later,counted_in_claim,finish_confirmed');
    expect(lines.slice(1)).toEqual([
      `2026-10-14,${ISO},save,home,08:30,16:06,456,no,yes,no`,
      '2026-10-14,2026-10-14T06:06:00.000Z,confirm,home,08:30,16:06,456,no,yes,yes',
      `2026-10-15,${ISO},save,office,,,,no,yes,no`,
      '',
    ]);
  });

  it('exports only the header for no days', () => {
    expect(revisionsCsv([])).toBe(
      'date,revised_at,kind,type,start,finish,minutes,added_later,counted_in_claim,finish_confirmed\n',
    );
  });
});

describe('exportFileName', () => {
  it('names each file by kind and income year', () => {
    expect(exportFileName('days', '2026-27')).toBe('work-days-2026-27.csv');
    expect(exportFileName('revisions', '2026-27')).toBe('work-revisions-2026-27.csv');
  });
});
