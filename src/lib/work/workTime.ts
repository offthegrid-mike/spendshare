// Pure 'HH:mm' and minutes maths for recording a Work day. Times of day are
// whole minutes since local midnight (0 to 1439), so no `new Date()` is needed.

/** A standard working day: 7.6 hours, in minutes. */
export const DEFAULT_MINUTES = 456;

const LAST_MINUTE_OF_DAY = 1439;

// Two-digit hours 00 to 23 and two-digit minutes 00 to 59, nothing around them.
const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** 'HH:mm' as minutes since midnight, or null if it is not a valid 24-hour time. */
export function parseHm(hm: string): number | null {
  const match = HM.exec(hm);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Minutes since midnight (0 to 1439) as a zero-padded 'HH:mm'. */
export function formatHm(minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * The finish time for a day that starts at `startHm` and runs `minutes`, or null
 * if the start is invalid, the length is not a positive whole number of minutes,
 * or the day would run past 23:59.
 */
export function finishFromStart(startHm: string, minutes: number): string | null {
  const start = parseHm(startHm);
  if (start === null || !Number.isInteger(minutes) || minutes <= 0) return null;
  const finish = start + minutes;
  return finish > LAST_MINUTE_OF_DAY ? null : formatHm(finish);
}

/** Minutes from `startHm` to `finishHm`, or null unless both parse and finish is after start. */
export function minutesBetween(startHm: string, finishHm: string): number | null {
  const start = parseHm(startHm);
  const finish = parseHm(finishHm);
  if (start === null || finish === null || finish <= start) return null;
  return finish - start;
}

/** Minutes as hours: '7.6' for an exact tenth of an hour, otherwise two decimals ('7.62'). */
export function formatHours(minutes: number): string {
  return (minutes / 60).toFixed(minutes % 6 === 0 ? 1 : 2);
}
