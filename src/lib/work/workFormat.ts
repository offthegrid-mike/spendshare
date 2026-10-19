import { weekdayOf } from './workDates';

// Display labels for Work days. The weekday and month come from fixed tables, not
// Intl: the abbreviations Intl gives for en-AU depend on the ICU version ('Jun',
// 'Jul' and 'Sep' on older ICU, 'June', 'July' and 'Sept' on Node 22), and a label
// has to read the same on every device and in tests. The tables are plain string
// lookups, so, like workDates.ts, there is no `new Date()` either.

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // index = ISO weekday - 1
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'Thu' for '2026-10-15'. */
export function weekdayShort(date: string): string {
  return WEEKDAYS[weekdayOf(date) - 1];
}

/** 'Thu 15' for '2026-10-15': the weekday and the day, without the month or zero padding. */
export function shortDayLabel(date: string): string {
  return `${weekdayShort(date)} ${Number(date.slice(8))}`;
}

/** 'Thu 15 Oct' for '2026-10-15'; the day has no zero padding ('Thu 1 Oct'). */
export function dayLabel(date: string): string {
  const m = Number(date.slice(5, 7));
  return `${shortDayLabel(date)} ${MONTHS[m - 1]}`;
}

/** Sorts anything with a 'YYYY-MM-DD' date ascending; the strings compare in date order. */
export function byDate(a: { date: string }, b: { date: string }): number {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}

/** The first `max` days as 'Thu 15 Oct, Fri 16 Oct', then ' +N more' for the rest. */
export function dayListLabel(dates: string[], max = 3): string {
  const shown = dates.slice(0, max).map(dayLabel).join(', ');
  const more = dates.length - max;
  return more > 0 ? `${shown} +${more} more` : shown;
}
