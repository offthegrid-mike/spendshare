/** Reads "8:30", "830", "0830" or "08:30" as "HH:mm"; null when it isn't a time. */
export function parseTime(text: string): string | null {
  const m = /^(\d{1,2}):?(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}
