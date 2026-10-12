import { computeAdjustment } from '../../lib/adjustment';
import { categoryTotals } from '../../lib/yearSummary';
import type { ExpenseDoc, ItemDoc } from '../../types/models';

export interface CategoryFilterResult {
  /** The expenses with an item in the category, in their original order. */
  expenses: ExpenseDoc[];
  /**
   * What was paid towards the category, by expense id, in cents: the
   * expense's net (after gift card and discount) shared out in proportion to
   * its items, so an expense that is all one category keeps its full net.
   */
  paidOf: Record<string, number>;
  /** The category's item amounts, in cents. */
  total: number;
}

/** The name items are listed under: their category, or Uncategorized when it is blank. */
const categoryOf = (item: Pick<ItemDoc, 'category'>) => item.category || 'Uncategorized';

const sumAmounts = (items: Pick<ItemDoc, 'amount'>[]) =>
  items.reduce((sum, it) => sum + Math.round(it.amount), 0);

/** The categories the items fall in, the biggest spend first and ties by name. */
export function categoriesBySpend(items: Pick<ItemDoc, 'category' | 'amount'>[]): string[] {
  return categoryTotals(items).map((c) => c.category);
}

/** The expenses with at least one item in `category`, and how much of each went on it. */
export function filterByCategory(
  expenses: ExpenseDoc[],
  itemsByExpense: Record<string, ItemDoc[]>,
  category: string,
): CategoryFilterResult {
  const kept: ExpenseDoc[] = [];
  const paidOf: Record<string, number> = {};
  let total = 0;
  for (const expense of expenses) {
    const items = itemsByExpense[expense.id] ?? [];
    const matching = items.filter((it) => categoryOf(it) === category);
    if (matching.length === 0) continue;
    const amount = sumAmounts(matching);
    const itemsTotal = sumAmounts(items);
    // With nothing to share out (all items free), the item amounts stand.
    paidOf[expense.id] = itemsTotal > 0
      ? Math.round((computeAdjustment(expense).net * amount) / itemsTotal)
      : amount;
    kept.push(expense);
    total += amount;
  }
  return { expenses: kept, paidOf, total };
}
