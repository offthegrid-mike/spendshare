import { isoDay } from '../month';

// Pure 'YYYY-MM-DD' string helpers for the Work tracker. Like lib/month.ts they
// avoid `new Date()` (Date.UTC and Intl on a numeric timestamp instead), so
// render code using them stays safe for tests that spy on the Date constructor.

const MS_PER_DAY = 86_400_000;

// Formats a UTC timestamp as 'YYYY-MM-DD'. A fixed zone, so it can be shared.
const utcDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function parseDay(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

// ---- Income year: 1 July to 30 June, keyed 'YYYY-YY' by the year it starts ----

function incomeYearKey(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

function incomeYearStart(key: string): number {
  return Number(key.slice(0, 4));
}

/** The income year a day falls in: '2026-06-30' is '2025-26', '2026-07-01' is '2026-27'. */
export function incomeYearOf(date: string): string {
  const { y, m } = parseDay(date);
  return incomeYearKey(m >= 7 ? y : y - 1);
}

/** '2026-27' as '2026–27' (en dash). */
export function incomeYearLabel(key: string): string {
  return `${key.slice(0, 4)}–${key.slice(5)}`;
}

/** First and last day of an income year, inclusive. */
export function incomeYearRange(key: string): { start: string; end: string } {
  const startYear = incomeYearStart(key);
  return { start: `${startYear}-07-01`, end: `${startYear + 1}-06-30` };
}

/** The income year `delta` years after (or, if negative, before) `key`. */
export function shiftIncomeYear(key: string, delta: number): string {
  return incomeYearKey(incomeYearStart(key) + delta);
}

// ---- Days ----

/** ISO weekday of a day: 1 Monday to 7 Sunday. */
export function weekdayOf(date: string): number {
  const { y, m, d } = parseDay(date);
  const days = Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
  // 1970-01-01 was a Thursday, ISO weekday 4.
  return ((((days + 3) % 7) + 7) % 7) + 1;
}

/** The day `n` days after (or, if negative, before) `date`. */
export function addDays(date: string, n: number): string {
  const { y, m, d } = parseDay(date);
  return utcDay.format(Date.UTC(y, m - 1, d + n));
}

// ---- Clock ----

export interface Clock {
  /** Today in the device's local time zone, 'YYYY-MM-DD'. */
  today: string;
  /** Minutes since local midnight, 0 to 1439. */
  nowMinutes: number;
}

/** The local date and time of day for a timestamp (now by default). */
export function clockNow(now: number = Date.now()): Clock {
  // Built per call, not shared: it should follow the device's current time zone.
  const parts = new Intl.DateTimeFormat('en-CA', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23', // midnight is hour 0, not 24
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { today: isoDay(now), nowMinutes: part('hour') * 60 + part('minute') };
}
