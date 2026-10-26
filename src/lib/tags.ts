import { collapseWhitespace, isDotsOnly, normalizeNameKey } from './textNormalize';
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

/** Whether `tags` has `tag`, whatever its case or spacing. */
export function hasTag(tags: string[], tag: string): boolean {
  const key = tagKey(tag);
  return tags.some((t) => typeof t === 'string' && tagKey(t) === key);
}

/** `tags` with `tag` added, unless it's blank, only dots, already there in any case, or the list is full. */
export function addTag(tags: string[], tag: string): string[] {
  const clean = cleanTag(tag);
  // "." and ".." would make a tag page's path resolve somewhere else.
  if (!clean || isDotsOnly(clean) || tags.length >= MAX_TAGS || hasTag(tags, clean)) return tags;
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
  return itemTags(first).filter((tag) => rest.every((it) => hasTag(itemTags(it), tag)));
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

/** An item's tags, leaving out anything that isn't text (the rules only check it's a list). */
function itemTags(item: Pick<ItemDoc, 'tags'>): string[] {
  return (item.tags ?? []).filter((t): t is string => typeof t === 'string');
}

/** Every tag in a group's history with what it adds up to, biggest first. */
export function tagTotals(expenses: ExpenseDoc[], itemsByExpense: Record<string, ItemDoc[]>): TagTotal[] {
  const totals = new Map<string, TagTotal & { expenseIds: Set<string> }>();
  // Oldest first, so the newest spelling of a tag names it.
  const oldestFirst = [...expenses].sort((a, b) => a.date.toMillis() - b.date.toMillis());
  for (const expense of oldestFirst) {
    for (const item of itemsByExpense[expense.id] ?? []) {
      for (const tag of itemTags(item)) {
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
  return [...expenses]
    .sort((a, b) => b.date.toMillis() - a.date.toMillis())
    .flatMap((expense) => {
      const tagged = (itemsByExpense[expense.id] ?? []).filter((it) => hasTag(itemTags(it), tag));
      return tagged.length > 0 ? [{ expense, amount: tagged.reduce((sum, it) => sum + signedAmount(it), 0) }] : [];
    });
}

/**
 * An expense's tags, each once (whatever its case), as its items spell them:
 * what the tag suggestions count per expense.
 */
export function expenseTags(items: Pick<ItemDoc, 'tags'>[]): string[] {
  const byKey = new Map<string, string>();
  for (const item of items) for (const tag of itemTags(item)) byKey.set(tagKey(tag), cleanTag(tag));
  return [...byKey.values()];
}

