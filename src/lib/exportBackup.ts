import type { Timestamp } from 'firebase/firestore';
import { fileSlug } from './exportCsv';
import { dayKey } from './month';
import type {
  CategoryDoc, ExpenseDoc, GroupDoc, GroupMember, IncomeDoc, ItemDoc, SettlementDoc, SuggestionsDoc, Uid,
} from '../types/models';

// The JSON backup: the whole group as stored, so a restore can be built from the
// file. Every id and field is kept; a Timestamp becomes an ISO 8601 UTC string,
// and member emails are left out. Invites (they hold emails) and the Work tracker
// (it belongs to one person, with its own export) are not part of it. Pure;
// reading the data is exportData's job.

export const BACKUP_SCHEMA_VERSION = 1;

/** A document as it is written to the file: Timestamps are ISO strings. */
type Json<T> = T extends Timestamp
  ? string
  : T extends (infer U)[]
    ? Json<U>[]
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T;

export interface BackupInput {
  group: GroupDoc;
  categories: CategoryDoc[];
  expenses: ExpenseDoc[];
  itemsByExpense: Record<string, ItemDoc[]>;
  income: IncomeDoc[];
  settlements: SettlementDoc[];
  /** null when the group has none yet. */
  suggestions: SuggestionsDoc | null;
}

export type BackupGroup = Omit<Json<GroupDoc>, 'members'> & {
  members: Record<Uid, Omit<Json<GroupMember>, 'email'>>;
};
export type BackupExpense = Json<ExpenseDoc> & { items: Json<ItemDoc>[] };

export interface Backup {
  schemaVersion: number;
  /** ISO 8601 UTC */
  exportedAt: string;
  group: BackupGroup;
  categories: Json<CategoryDoc>[];
  expenses: BackupExpense[];
  income: Json<IncomeDoc>[];
  settlements: Json<SettlementDoc>[];
  suggestions: Json<SuggestionsDoc> | null;
}

function isTimestamp(value: unknown): value is Timestamp {
  return typeof value === 'object' && value !== null && typeof (value as { toDate?: unknown }).toDate === 'function';
}

/** `value` with every Timestamp in it as an ISO string, and no undefined fields. */
function toJson<T>(value: T): Json<T> {
  if (isTimestamp(value)) return value.toDate().toISOString() as Json<T>;
  if (Array.isArray(value)) return value.map(toJson) as Json<T>;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    return Object.fromEntries(entries.map(([k, v]) => [k, toJson(v)])) as Json<T>;
  }
  return value as Json<T>;
}

function withoutEmail(member: GroupMember): Omit<Json<GroupMember>, 'email'> {
  const copy: Partial<Json<GroupMember>> = toJson(member);
  delete copy.email;
  return copy as Omit<Json<GroupMember>, 'email'>;
}

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);

export function buildBackup(input: BackupInput, exportedAt: Date): Backup {
  const { group } = input;
  const expenses = [...input.expenses].sort(
    (a, b) => a.date.toDate().getTime() - b.date.toDate().getTime() || byId(a, b),
  );
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    group: {
      ...toJson({ ...group, members: {} }),
      members: Object.fromEntries(Object.entries(group.members).map(([uid, member]) => [uid, withoutEmail(member)])),
    },
    categories: [...input.categories].sort((a, b) => a.order - b.order || byId(a, b)).map(toJson),
    expenses: expenses.map((expense) => ({
      ...toJson(expense),
      items: [...(input.itemsByExpense[expense.id] ?? [])].sort(byId).map(toJson),
    })),
    income: [...input.income]
      .sort((a, b) => a.month.localeCompare(b.month) || a.uid.localeCompare(b.uid) || (a.id ?? '').localeCompare(b.id ?? ''))
      .map(toJson),
    settlements: [...input.settlements].sort((a, b) => a.month.localeCompare(b.month) || byId(a, b)).map(toJson),
    suggestions: input.suggestions ? toJson(input.suggestions) : null,
  };
}

/** 'spendshare-hartley-house-backup-2026-10-26.json' */
export function backupFileName(group: Pick<GroupDoc, 'name'>, exportedAt: Date): string {
  return `spendshare-${fileSlug(group.name)}-backup-${dayKey(exportedAt)}.json`;
}
