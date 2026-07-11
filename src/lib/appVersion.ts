import { format } from 'date-fns';

/**
 * Human-readable build stamp shown in the UI so a specific deploy can be
 * confirmed as live in production (vs. still pending in CI).
 */
export function formatVersionLabel(commit: string, builtAt: string): string {
  const date = new Date(builtAt);
  const dateLabel = isNaN(date.getTime()) ? builtAt : format(date, 'yyyy-MM-dd');
  return commit === 'dev' ? `dev build · ${dateLabel}` : `${commit} · built ${dateLabel}`;
}
