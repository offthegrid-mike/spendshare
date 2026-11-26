import { dayKey, formatMonthLabel } from './month';
import type { GroupDoc } from '../types/models';

// Names in exports: the period an export covers, its file name, and the names of people in it.

/** What an export covers: a month ('2026-10') or a whole year ('2026'). */
export type ExportPeriod = { kind: 'month'; month: string } | { kind: 'year'; year: string };

/** The first and last month ('YYYY-MM') of a period, both included. */
export function periodMonths(period: ExportPeriod): { from: string; to: string } {
  return period.kind === 'month'
    ? { from: period.month, to: period.month }
    : { from: `${period.year}-01`, to: `${period.year}-12` };
}

/** 'October 2026' or '2026' */
export function periodLabel(period: ExportPeriod): string {
  return period.kind === 'month' ? formatMonthLabel(period.month) : period.year;
}

/** A name safe to put in a file name: lower case ASCII words joined by dashes, 'group' when none is left. */
function fileSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'group';
}

/** 'spendshare-hartley-house-2026-10.csv' or 'spendshare-hartley-house-2026.csv'. */
export function csvFileName(group: Pick<GroupDoc, 'name'>, period: ExportPeriod): string {
  return `spendshare-${fileSlug(group.name)}-${period.kind === 'month' ? period.month : period.year}.csv`;
}

/** 'spendshare-hartley-house-backup-2026-10-26.json' */
export function backupFileName(group: Pick<GroupDoc, 'name'>, exportedAt: Date): string {
  return `spendshare-${fileSlug(group.name)}-backup-${dayKey(exportedAt)}.json`;
}

// An address ends at whitespace or a bracket or comma, so 'Priya (priya@example.com)' keeps its closing bracket.
const EMAIL = /([^\s@()<>,;]+)@[^\s@()<>,;]+\.[^\s@()<>,;]+/g;

/**
 * A person's name with no email address in it. A member who signed in without a
 * display name is called by their email, so a name can be an address: keep what
 * is before the @. Exports leave emails out.
 */
export function exportName(name: string): string {
  return name.replace(EMAIL, '$1');
}
