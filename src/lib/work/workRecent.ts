import type { WorkDayDoc, WorkDayType, WorkSettingsDoc } from '../../types/models';
import { addDays, incomeYearOf, incomeYearRange, weekdayOf, type Clock } from './workDates';
import { isMissingDay } from './workLists';

// Pure helpers behind the Home Work tile (spec 6.4): today's status and the strip
// of the last few working days. The tile loads only the income year containing
// today, so a day before that year cannot be judged and shows as 'none'. Days are
// local 'YYYY-MM-DD' strings and the clock is passed in.

export type RecentStatus = WorkDayType | 'missing' | 'unrecorded' | 'none';

export interface RecentDay {
  date: string;
  status: RecentStatus;
  isToday: boolean;
}

export type TodayStatus =
  | { kind: 'recorded'; type: WorkDayType; minutes?: number }
  | { kind: 'unrecorded' }
  | { kind: 'offday' };

// How far back the strip looks for work weekdays, so a settings list with few
// (or no) work days cannot make it scan without end.
const LOOK_BACK_DAYS = 21;

function statusOf(
  date: string,
  day: WorkDayDoc | undefined,
  yearStart: string,
  settings: WorkSettingsDoc,
  clock: Clock,
): RecentStatus {
  if (date < yearStart) return 'none';
  if (day !== undefined && day.type !== null) return day.type;
  if (date === clock.today) return 'unrecorded';
  return isMissingDay(date, day, settings, clock) ? 'missing' : 'none';
}

/**
 * The last `count` work weekdays up to and including today, oldest first, each
 * with its status: its recorded type, else 'unrecorded' for today, 'missing' for
 * a missing day, or 'none'. Looks back at most 21 days, so it may give fewer.
 */
export function recentWorkingDays(
  days: WorkDayDoc[],
  settings: WorkSettingsDoc,
  clock: Clock,
  count = 5,
): RecentDay[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const yearStart = incomeYearRange(incomeYearOf(clock.today)).start;
  const recent: RecentDay[] = [];
  for (let back = 0; back <= LOOK_BACK_DAYS && recent.length < count; back++) {
    const date = addDays(clock.today, -back);
    if (!settings.workWeekdays.includes(weekdayOf(date))) continue;
    recent.push({
      date,
      status: statusOf(date, byDate.get(date), yearStart, settings, clock),
      isToday: back === 0,
    });
  }
  return recent.reverse();
}

/** Today as recorded (with the minutes of a Home day), not recorded yet, or a day off with no record. */
export function todayStatus(days: WorkDayDoc[], settings: WorkSettingsDoc, clock: Clock): TodayStatus {
  const today = days.find((day) => day.date === clock.today);
  if (today !== undefined && today.type !== null) {
    return today.type === 'home' && today.minutes !== undefined
      ? { kind: 'recorded', type: 'home', minutes: today.minutes }
      : { kind: 'recorded', type: today.type };
  }
  return settings.workWeekdays.includes(weekdayOf(clock.today)) ? { kind: 'unrecorded' } : { kind: 'offday' };
}
