import type { Timestamp } from 'firebase/firestore';
import type { WorkDayDoc } from '../../types/models';
import type { Clock } from './workDates';
import { byDate, weekdayShort } from './workFormat';
import type { ResolvedRate } from './workRates';
import { formatHours } from './workTime';
import { summariseYear } from './workYear';

// The two CSV files of the Work export (spec 7.6), built in the browser from the
// same day documents the screens show: one row per day with a summary block, and
// one row per revision so every change can be traced. Pure: the download is
// downloadCsv's job.

type Cell = string | number | null | undefined;

/** A CSV cell: empty for null or undefined, quoted when it holds a comma, a quote or a newline. */
export function csvEscape(value: Cell): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const DAYS_HEADER = [
  'date',
  'weekday',
  'type',
  'start',
  'finish',
  'minutes',
  'hours',
  'first_recorded_at',
  'last_saved_at',
  'synced_at',
  'added_later',
  'counted_in_claim',
  'finish_confirmed',
  'confirmed_at',
  'revisions',
];

const REVISIONS_HEADER = [
  'date',
  'revised_at',
  'kind',
  'type',
  'start',
  'finish',
  'minutes',
  'added_later',
  'counted_in_claim',
  'finish_confirmed',
];

function line(cells: Cell[]): string {
  return `${cells.map(csvEscape).join(',')}\n`;
}

// A pending write's syncedAt is null until the server acknowledges it.
function iso(stamp: Timestamp | null | undefined): string {
  return stamp ? stamp.toDate().toISOString() : '';
}

function yesNo(value: boolean): string {
  return value ? 'yes' : 'no';
}

function rateSource(rate: ResolvedRate): string {
  return rate.source === 'carried' && rate.carriedFrom !== undefined ? `carried from ${rate.carriedFrom}` : rate.source;
}

/** The days file: the header, a row per day ascending by date, a blank line, then the year's totals. */
export function daysCsv(days: WorkDayDoc[], incomeYear: string, rate: ResolvedRate, clock: Clock): string {
  const rows = [...days].sort(byDate).map((day) =>
    line([
      day.date,
      weekdayShort(day.date),
      day.type,
      day.startTime,
      day.finishTime,
      day.minutes,
      day.type === 'home' && day.minutes !== undefined ? formatHours(day.minutes) : null,
      iso(day.firstRecordedAt),
      iso(day.recordedAt),
      iso(day.syncedAt),
      yesNo(day.addedLater),
      yesNo(day.countedInClaim),
      yesNo(day.finishConfirmed),
      iso(day.finishConfirmedAt),
      day.revisions.length,
    ]),
  );

  const summary = summariseYear(days, rate.cents, clock);
  const totals = [
    line(['Income year', incomeYear]),
    line(['Counted home days', summary.counted.days]),
    line(['Counted home hours', formatHours(summary.counted.minutes)]),
    line(['Not confirmed hours (still counted)', formatHours(summary.notConfirmed.minutes)]),
    line(['Added later hours (not counted)', formatHours(summary.addedLater.minutes)]),
    line(['Rate (cents per hour)', rate.cents]),
    line(['Rate source', rateSource(rate)]),
    line(['Claim before dropping cents', (summary.claimCents / 100).toFixed(2)]),
    line(['Claim (cents dropped)', summary.claimDollars]),
  ];

  return [line(DAYS_HEADER), ...rows, '\n', ...totals].join('');
}

/** The revisions file: the header, then every revision of every day, by date then revision order. */
export function revisionsCsv(days: WorkDayDoc[]): string {
  const rows = [...days].sort(byDate).flatMap((day) =>
    day.revisions.map((revision) =>
      line([
        day.date,
        iso(revision.at),
        revision.kind,
        revision.type,
        revision.startTime,
        revision.finishTime,
        revision.minutes,
        yesNo(revision.addedLater),
        yesNo(revision.countedInClaim),
        yesNo(revision.finishConfirmed),
      ]),
    ),
  );
  return [line(REVISIONS_HEADER), ...rows].join('');
}

/** 'work-days-2026-27.csv' or 'work-revisions-2026-27.csv'. */
export function exportFileName(kind: 'days' | 'revisions', incomeYear: string): string {
  return `work-${kind}-${incomeYear}.csv`;
}
