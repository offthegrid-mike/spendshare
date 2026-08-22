import type { ReactNode } from 'react';
import { createElement } from 'react';
import { collapseWhitespace } from './textNormalize';
import type { ExpenseDoc, ItemDoc } from '../types/models';

export const collator = new Intl.Collator(undefined, { sensitivity: 'base', usage: 'search' });

/**
 * Index of the first occurrence of `needle` anywhere in `haystack`, comparing
 * with a search collator so the match is case- and diacritic-insensitive for
 * Latin text and exact for CJK. Returns -1 when there is no match.
 */
export function findMatchIndex(haystack: string, needle: string): number {
  const h = haystack.normalize('NFC');
  const n = needle.normalize('NFC');
  if (n.length === 0) return -1;
  for (let i = 0; i <= h.length - n.length; i++) {
    if (collator.compare(h.slice(i, i + n.length), n) === 0) return i;
  }
  return -1;
}

export function highlightMatch(name: string, query: string): ReactNode {
  const normName = name.normalize('NFC');
  const normQuery = query.normalize('NFC');
  const idx = findMatchIndex(normName, normQuery);
  if (idx === -1) return createElement('span', null, name);
  const before = normName.slice(0, idx);
  const match  = normName.slice(idx, idx + normQuery.length);
  const after  = normName.slice(idx + normQuery.length);
  return createElement('span', null,
    before,
    createElement('strong', null, match),
    after,
  );
}

export interface SearchResult {
  expense: ExpenseDoc;
  /** True when the query matched the shop name itself. */
  shopMatch: boolean;
  /** Items on this expense whose name matched, in document order. */
  matchedItems: ItemDoc[];
}

function dateMillis(expense: ExpenseDoc): number {
  return expense.date ? expense.date.toMillis() : 0;
}

/**
 * Finds expenses whose shop name, or one of whose item names, contains `rawQuery`
 * anywhere. An empty query matches nothing — callers show a prompt instead of the
 * whole history. Results are most-recent-first.
 */
export function searchExpenses(
  expenses: ExpenseDoc[],
  itemsByExpense: Record<string, ItemDoc[]>,
  rawQuery: string,
): SearchResult[] {
  const query = collapseWhitespace(rawQuery);
  if (query.length === 0) return [];

  const results: SearchResult[] = [];
  for (const expense of expenses) {
    const shopMatch = findMatchIndex(expense.shopName ?? '', query) !== -1;
    const matchedItems = (itemsByExpense[expense.id] ?? []).filter(
      (item) => findMatchIndex(item.name ?? '', query) !== -1,
    );
    if (shopMatch || matchedItems.length > 0) {
      results.push({ expense, shopMatch, matchedItems });
    }
  }
  return results.sort((a, b) => dateMillis(b.expense) - dateMillis(a.expense));
}
