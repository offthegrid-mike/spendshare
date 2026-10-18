// Home's greeting and date line. Pure and built on `Intl` with a numeric
// timestamp, so render code using them stays safe for tests that spy on the
// Date constructor (the same approach as `month.ts`).

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

/** The device-local hour of a timestamp, 0 to 23. */
export function hourOf(nowMs: number): number {
  const parts = new Intl.DateTimeFormat('en-AU', { hour: 'numeric', hourCycle: 'h23' }).formatToParts(nowMs);
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
}

/** 'Monday 19 October' in the device's time zone; assembled from parts so locale punctuation can't change it. */
export function longDate(nowMs: number): string {
  const parts = new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }).formatToParts(nowMs);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('weekday')} ${part('day')} ${part('month')}`;
}
