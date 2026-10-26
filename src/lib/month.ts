import { format } from 'date-fns';
export function monthKey(d: Date): string { return format(d, 'yyyy-MM'); }

// Pure 'YYYY-MM' string helpers below: no `new Date()`, so render code using
// them stays safe for tests that spy on the Date constructor.

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseYM(ym: string): { year: number; month: number } {
  const [year, month] = ym.split('-').map(Number);
  return { year, month };
}

function toKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function prevMonthKey(ym: string): string {
  const { year, month } = parseYM(ym);
  return month === 1 ? toKey(year - 1, 12) : toKey(year, month - 1);
}

export function nextMonthKey(ym: string): string {
  const { year, month } = parseYM(ym);
  return month === 12 ? toKey(year + 1, 1) : toKey(year, month + 1);
}

/** 'October 2026' */
export function formatMonthLabel(ym: string): string {
  const { year, month } = parseYM(ym);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** 'YYYY-MM-DD' for a timestamp, via Intl (avoids `new Date()`). */
export function isoDay(now: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** The current month as 'YYYY-MM'. */
export function todayMonthKey(): string {
  return isoDay(Date.now()).slice(0, 7);
}

/** Month keys from `from` to `to` inclusive, newest first; empty when from > to. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = to; k >= from; k = prevMonthKey(k)) out.push(k);
  return out;
}

/** 'October' */
export function monthName(ym: string): string {
  return MONTH_NAMES[parseYM(ym).month - 1];
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** How many days `ym` has. */
export function daysInMonthKey(ym: string): number {
  const { year, month } = parseYM(ym);
  return daysInMonth(year, month);
}

/**
 * How many days of `ym` have passed: its full length for a finished month,
 * today's day of the month for the current one, 0 for one yet to start.
 */
export function daysElapsedInMonth(ym: string, now: number = Date.now()): number {
  const today = isoDay(now);
  const todayMonth = today.slice(0, 7);
  if (ym > todayMonth) return 0;
  if (ym === todayMonth) return Number(today.slice(8, 10));
  const { year, month } = parseYM(ym);
  return daysInMonth(year, month);
}

/**
 * The last day of the month before `ym` to set beside it: the same day of the
 * month as today while `ym` is in progress, so a month part-way through isn't
 * measured against a whole one. null means all of it: `ym` is over, or the days
 * gone already cover the whole of a shorter month before.
 */
export function comparablePrevDays(ym: string, now: number = Date.now()): number | null {
  const elapsed = daysElapsedInMonth(ym, now);
  const { year, month } = parseYM(ym);
  const prev = parseYM(prevMonthKey(ym));
  if (elapsed >= daysInMonth(year, month) || elapsed >= daysInMonth(prev.year, prev.month)) return null;
  return elapsed;
}

/** '12 Oct' for 'YYYY-MM-DD'. */
export function formatDayMonth(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${day} ${MONTH_NAMES[month - 1].slice(0, 3)}`;
}

/** What a comparison is against: 'September', or '1–12 September' for its first twelve days. */
export function comparisonLabel(prevYm: string, throughDay: number | null): string {
  const name = monthName(prevYm);
  if (throughDay === null) return name;
  return throughDay === 1 ? `1 ${name}` : `1–${throughDay} ${name}`;
}
