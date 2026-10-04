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

/** The current month as 'YYYY-MM', via Intl (avoids `new Date()`). */
export function todayMonthKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
  }).format(Date.now()).slice(0, 7);
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
