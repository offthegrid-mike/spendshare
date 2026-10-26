import {
  collectionGroup, getDocFromServer, getDocsFromServer, query, where,
  type DocumentData, type QuerySnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { categoriesCol, expensesCol, incomeCol, settlementsCol, suggestionsDocRef } from './converters';
import type { BackupInput } from './exportBackup';
import { periodMonths, type ExportPeriod } from './exportCsv';
import type { CategoryDoc, ExpenseDoc, IncomeDoc, ItemDoc, SettlementDoc, SuggestionsDoc } from '../types/models';

// What an export reads. Always from the server, never the offline cache or the
// shared history: an export of stale or partial data is worse than a clear
// failure, so offline it says so and stops.

/** A failure with a message fit to show the person. */
export class ExportError extends Error {}

const OFFLINE = "Couldn't reach the server. Check your connection and try again.";
const FAILED = "Couldn't read your data to export it. Try again.";

async function fromServer<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (err) {
    const offline = (err as { code?: string } | null)?.code === 'unavailable';
    throw new ExportError(offline ? OFFLINE : FAILED, { cause: err });
  }
}

function docsOf<T>(snap: QuerySnapshot<DocumentData>): T[] {
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T);
}

function groupByExpense(items: ItemDoc[]): Record<string, ItemDoc[]> {
  const byExpense: Record<string, ItemDoc[]> = {};
  for (const item of items) (byExpense[item.expenseId] ??= []).push(item);
  return byExpense;
}

export interface PeriodData {
  expenses: ExpenseDoc[];
  itemsByExpense: Record<string, ItemDoc[]>;
}

/** The expenses and items of one month or year. `month` is 'YYYY-MM', so a lexical range covers a year. */
export async function loadPeriodData(gid: string, period: ExportPeriod): Promise<PeriodData> {
  const { from, to } = periodMonths(period);
  const [expenses, items] = await fromServer(() =>
    Promise.all([
      getDocsFromServer(query(expensesCol(gid), where('month', '>=', from), where('month', '<=', to))),
      // Served by the items (groupId ASC, month ASC) collection-group index.
      getDocsFromServer(
        query(collectionGroup(db, 'items'), where('groupId', '==', gid), where('month', '>=', from), where('month', '<=', to)),
      ),
    ]),
  );
  return { expenses: docsOf<ExpenseDoc>(expenses), itemsByExpense: groupByExpense(docsOf<ItemDoc>(items)) };
}

export type BackupData = Omit<BackupInput, 'group'>;

/** Everything a backup holds besides the group itself. */
export async function loadBackupData(gid: string): Promise<BackupData> {
  const [expenses, items, categories, income, settlements, suggestions] = await fromServer(() =>
    Promise.all([
      getDocsFromServer(expensesCol(gid)),
      getDocsFromServer(query(collectionGroup(db, 'items'), where('groupId', '==', gid))),
      getDocsFromServer(categoriesCol(gid)),
      getDocsFromServer(incomeCol(gid)),
      getDocsFromServer(settlementsCol(gid)),
      getDocFromServer(suggestionsDocRef(gid)),
    ]),
  );
  return {
    expenses: docsOf<ExpenseDoc>(expenses),
    itemsByExpense: groupByExpense(docsOf<ItemDoc>(items)),
    categories: docsOf<CategoryDoc>(categories),
    income: docsOf<IncomeDoc>(income),
    settlements: docsOf<SettlementDoc>(settlements),
    suggestions: suggestions.exists() ? (suggestions.data() as SuggestionsDoc) : null,
  };
}
