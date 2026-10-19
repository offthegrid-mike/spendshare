// Home's greeting and date line. Pure and built on `Intl` with a numeric
// timestamp from Date.UTC (no `new Date()`), so render code using them stays
// safe for tests that spy on the Date constructor (the same approach as `month.ts`).

/** 'Good morning, Mike': morning before noon, afternoon until 18:00, evening after. */
export function greeting(hour: number, firstName: string): string {
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  return `Good ${part}, ${firstName}`;
}

/** The first word of the display name, else the email's local part, else 'there'. */
export function firstNameOf(displayName: string | null, email: string | null): string {
  const first = displayName?.trim().split(/\s+/)[0];
  if (first) return first;
  const local = email?.split('@')[0].trim();
  return local || 'there';
}

/**
 * 'Monday 19 October' for the local date '2026-10-19'. Formatted in UTC from the
 * date's own parts, so the device's zone cannot shift the day; assembled from
 * parts so locale punctuation can't change it.
 */
export function longDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const format = new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
  const parts = format.formatToParts(Date.UTC(y, m - 1, d));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('weekday')} ${part('day')} ${part('month')}`;
}
