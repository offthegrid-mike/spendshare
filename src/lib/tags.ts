import { collapseWhitespace, normalizeNameKey } from './textNormalize';
import { signedAmount } from './refund';
import type { ExpenseDoc, ItemDoc } from '../types/models';

/** Tags per item, and the longest a tag can be; the rules check the count. */
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 40;

/** A tag as stored: whitespace collapsed, at most MAX_TAG_LENGTH characters. */
export function cleanTag(tag: string): string {
  return collapseWhitespace(tag).slice(0, MAX_TAG_LENGTH);
}

/** What tags are matched by: case and spacing don't matter. */
export function tagKey(tag: string): string {
  return normalizeNameKey(tag);
}

/** `tags` with `tag` added, unless it's blank, already there in any case, or the list is full. */
export function addTag(tags: string[], tag: string): string[] {
  const clean = cleanTag(tag);
  if (!clean || tags.length >= MAX_TAGS || tags.some((t) => tagKey(t) === tagKey(clean))) return tags;
  return [...tags, clean];
}

/** `tags` without `tag`, whatever its case. */
export function removeTag(tags: string[], tag: string): string[] {
  return tags.filter((t) => tagKey(t) !== tagKey(tag));
}

/** The tags every item has: what an expense-wide tag control shows. */
export function sharedTags(items: Pick<ItemDoc, 'tags'>[]): string[] {
  if (items.length === 0) return [];
  const [first, ...rest] = items;
  return (first.tags ?? []).filter((tag) => rest.every((it) => (it.tags ?? []).some((t) => tagKey(t) === tagKey(tag))));
}

export interface TagTotal {
  /** The tag as last written. */
  tag: string;
  /** What its items add up to, in cents, refunds taken off. */
  amount: number;
  items: number;
  expenses: number;
  /** The month it was last used in, 'YYYY-MM'. */
  lastMonth: string;
}

const hasTag = (item: Pick<ItemDoc, 'tags'>, key: string) => (item.tags ?? []).some((t) => tagKey(t) === key);

/** Every tag in a group's history with what it adds up to, biggest first. */
export function tagTotals(expenses: ExpenseDoc[], itemsByExpense: Record<string, ItemDoc[]>): TagTotal[] {
  const totals = new Map<string, TagTotal & { expenseIds: Set<string> }>();
  // Oldest first, so the newest spelling of a tag names it.
  const oldestFirst = [...expenses].sort((a, b) => a.date.toMillis() - b.date.toMillis());
  for (const expense of oldestFirst) {
    for (const item of itemsByExpense[expense.id] ?? []) {
      for (const tag of item.tags ?? []) {
        const key = tagKey(tag);
        const total = totals.get(key) ?? { tag, amount: 0, items: 0, expenses: 0, lastMonth: expense.month, expenseIds: new Set<string>() };
        total.tag = tag;
        total.amount += signedAmount(item);
        total.items += 1;
        total.expenseIds.add(expense.id);
        total.lastMonth = expense.month;
        totals.set(key, total);
      }
    }
  }
  return [...totals.values()]
    .map(({ expenseIds, ...total }) => ({ ...total, expenses: expenseIds.size }))
    .sort((a, b) => b.amount - a.amount || a.tag.localeCompare(b.tag));
}

/** The expenses with an item tagged `tag`, newest first, each with what its tagged items add up to. */
export function tagExpenses(
  tag: string,
  expenses: ExpenseDoc[],
  itemsByExpense: Record<string, ItemDoc[]>,
): { expense: ExpenseDoc; amount: number }[] {
  const key = tagKey(tag);
  return [...expenses]
    .sort((a, b) => b.date.toMillis() - a.date.toMillis())
    .flatMap((expense) => {
      const tagged = (itemsByExpense[expense.id] ?? []).filter((it) => hasTag(it, key));
      return tagged.length > 0 ? [{ expense, amount: tagged.reduce((sum, it) => sum + signedAmount(it), 0) }] : [];
    });
}
