const MS_PER_DAY = 86_400_000;
const MAX_TICKS = 6;
const SHORT_STRETCH_DAYS = 62;
const MONTH_STEPS = [1, 2, 3, 6, 12, 24, 60];

/** Whole days from 1 January 1970 to 'YYYY-MM-DD', so dates can sit on a numeric axis. */
export function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

/** The 'YYYY-MM-DD' a day number stands for. */
export function dayDate(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Tick positions for a date axis from `min` to `max` (day numbers): a few evenly spaced days
 * for a short stretch, otherwise the first of every month, skipping months so there are never
 * more than six. `unit` says what the labels should show.
 */
export function timeTicks(min: number, max: number): { ticks: number[]; unit: 'day' | 'month' } {
  if (max - min <= SHORT_STRETCH_DAYS) {
    const evenly = [0, 1, 2, 3].map((i) => Math.round(min + ((max - min) * i) / 3));
    return { ticks: [...new Set(evenly)], unit: 'day' };
  }
  const [year, month] = dayDate(min).split('-').map(Number);
  // The first of the month after `min`, as a month count (year * 12 + month index).
  const first = year * 12 + month;
  const monthStart = (index: number) => Math.round(Date.UTC(Math.floor(index / 12), index % 12, 1) / MS_PER_DAY);
  for (const step of MONTH_STEPS) {
    const ticks: number[] = [];
    for (let index = first; monthStart(index) <= max; index += step) ticks.push(monthStart(index));
    if (ticks.length <= MAX_TICKS) return { ticks, unit: 'month' };
  }
  return { ticks: [], unit: 'month' };
}
