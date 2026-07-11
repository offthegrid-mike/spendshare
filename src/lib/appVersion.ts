import { isValid } from 'date-fns';

function utcDateLabel(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Human-readable build stamp shown in the UI so a specific deploy can be
 * confirmed as live in production (vs. still pending in CI). The date is
 * rendered in UTC — the viewer's local timezone would shift it by a day
 * near midnight UTC, defeating the point of the stamp.
 */
export function formatVersionLabel(commit: string | null, builtAt: string): string {
  const date = new Date(builtAt);
  const dateLabel = isValid(date) ? utcDateLabel(date) : builtAt;
  return commit ? `${commit} · built ${dateLabel}` : `dev build · ${dateLabel}`;
}
