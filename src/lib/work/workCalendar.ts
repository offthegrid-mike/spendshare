import type { WorkDayDoc, WorkDayType, WorkSettingsDoc } from '../../types/models';
import { nextMonthKey } from '../month';
import { addDays, weekdayOf, type Clock } from './workDates';
import { isMissingDay } from './workLists';
import { isUnconfirmed } from './workYear';

// The cells of one month's calendar grid (spec 7.3): Monday-first weeks, padded
// with blank cells at both ends. Pure string maths on 'YYYY-MM' and 'YYYY-MM-DD',
// with the clock passed in.

export type CalendarStatus = WorkDayType | 'missing' | 'empty' | 'future' | 'blank';

export interface CalendarCell {
  /** 'YYYY-MM-DD'; null for a blank cell. */
  date: string | null;
  /** Day of the month; null for a blank cell. */
  day: number | null;
  status: CalendarStatus;
  today: boolean;
  /** A recorded day that was added after the day itself. */
  late: boolean;
  /** A Home day whose finish has passed without being confirmed. */
  unconfirmed: boolean;
  /** Today or an earlier day: the days that can be recorded. */
  selectable: boolean;
}

// A new object each time, so no two cells share one a caller might change.
function blankCell(): CalendarCell {
  return { date: null, day: null, status: 'blank', today: false, late: false, unconfirmed: false, selectable: false };
}

function cellFor(
  date: string,
  record: WorkDayDoc | undefined,
  settings: WorkSettingsDoc,
  clock: Clock,
): CalendarCell {
  // A cleared document (type null) counts as no record.
  const type = record?.type ?? null;
  let status: CalendarStatus;
  if (type !== null) status = type;
  else if (date > clock.today) status = 'future';
  else if (isMissingDay(date, record, settings, clock)) status = 'missing';
  else status = 'empty';

  return {
    date,
    day: Number(date.slice(8)),
    status,
    today: date === clock.today,
    late: type !== null && record?.addedLater === true,
    unconfirmed: record !== undefined && isUnconfirmed(record, clock),
    selectable: date <= clock.today,
  };
}

/**
 * The grid for `month` ('YYYY-MM'), Monday first. Leading and trailing blank
 * cells make the length a multiple of 7. A recorded day shows its type; any
 * other day is future, missing (per `isMissingDay`) or empty.
 */
export function calendarCells(
  month: string,
  days: WorkDayDoc[],
  settings: WorkSettingsDoc,
  clock: Clock,
): CalendarCell[] {
  const first = `${month}-01`;
  const lastDay = Number(addDays(`${nextMonthKey(month)}-01`, -1).slice(8));
  const byDate = new Map(days.map((record) => [record.date, record]));

  // ISO weekday 1 (Monday) needs no padding, 7 (Sunday) needs six blanks.
  const cells: CalendarCell[] = Array.from({ length: weekdayOf(first) - 1 }, blankCell);
  for (let d = 1; d <= lastDay; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    cells.push(cellFor(date, byDate.get(date), settings, clock));
  }
  while (cells.length % 7 !== 0) cells.push(blankCell());
  return cells;
}
