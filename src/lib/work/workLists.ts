import type { WorkDayDoc, WorkSettingsDoc } from '../../types/models';
import { addDays, incomeYearOf, incomeYearRange, weekdayOf, type Clock } from './workDates';
import { isUnconfirmed } from './workYear';

// Pure lists behind the Work banners (spec 7.4): the working days that were never
// recorded, and the Home days still waiting for their finish to be confirmed.
// Days are local 'YYYY-MM-DD' strings, which compare in date order as plain
// strings, and the clock is passed in.

/**
 * Whether `date` is a missing day: a working weekday that is over (before today),
 * on or after the tracking start date, with no recorded type. `day` is the stored
 * document for that date, if there is one; a cleared document (type null) counts
 * as no record. Nothing is missing until a tracking start date is set.
 */
export function isMissingDay(
  date: string,
  day: WorkDayDoc | undefined,
  settings: WorkSettingsDoc,
  clock: Clock,
): boolean {
  const { trackingStartDate } = settings;
  if (trackingStartDate === null) return false;
  if (date < trackingStartDate || date >= clock.today) return false;
  if (!settings.workWeekdays.includes(weekdayOf(date))) return false;
  return day === undefined || day.type === null;
}

/**
 * Every missing day in the income year containing today, ascending. The scan runs
 * from the later of the tracking start date and the start of that income year up
 * to yesterday, so it never looks further back than one income year.
 */
export function missingDates(days: WorkDayDoc[], settings: WorkSettingsDoc, clock: Clock): string[] {
  const { trackingStartDate } = settings;
  if (trackingStartDate === null) return [];
  const yearStart = incomeYearRange(incomeYearOf(clock.today)).start;
  const first = trackingStartDate > yearStart ? trackingStartDate : yearStart;
  const last = addDays(clock.today, -1);

  const byDate = new Map(days.map((day) => [day.date, day]));
  const missing: string[] = [];
  // Bounded: `first` is no earlier than the income year start and `last` is before
  // today, so this runs at most once per day of one income year, and not at all
  // when the range is empty (a start date today or later).
  for (let date = first; date <= last; date = addDays(date, 1)) {
    if (isMissingDay(date, byDate.get(date), settings, clock)) missing.push(date);
  }
  return missing;
}

/** The dates of the Home days waiting for a confirmed finish, ascending. */
export function toConfirmDates(days: WorkDayDoc[], clock: Clock): string[] {
  return days
    .filter((day) => isUnconfirmed(day, clock))
    .map((day) => day.date)
    .sort();
}
