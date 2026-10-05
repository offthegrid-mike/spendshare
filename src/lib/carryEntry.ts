import type { CategoryDoc } from '../types/models';
import type { ExpenseDraftValues } from '../hooks/useExpenseDraft';

const norm = (name: string) => name.trim().toLowerCase();

/**
 * Moves an in-progress expense entry to another group. Categories are matched
 * by name; an item whose category has no match takes the target's first active
 * category and is flagged for the user to check. Items with no category stay
 * uncategorised. An existing flag survives a later move when the item matches
 * by name, because the earlier category was a guess. The payer becomes the
 * current user, who is in every group.
 */
export function carryEntry(
  values: ExpenseDraftValues,
  fromCats: CategoryDoc[],
  toActive: CategoryDoc[],
  currentUid: string,
): { values: ExpenseDraftValues; flagged: number } {
  let flagged = 0;
  const items = values.items.map((item) => {
    if (item.categoryId === '') return { ...item, categoryUnconfirmed: false };
    const sourceName = fromCats.find((c) => c.id === item.categoryId)?.name;
    const match = sourceName === undefined ? undefined : toActive.find((c) => norm(c.name) === norm(sourceName));
    if (match) {
      const keepFlag = item.categoryUnconfirmed === true;
      if (keepFlag) flagged += 1;
      return { ...item, categoryId: match.id, categoryUnconfirmed: keepFlag };
    }
    flagged += 1;
    return { ...item, categoryId: toActive[0]?.id ?? '', categoryUnconfirmed: true };
  });
  return { values: { ...values, payerUid: currentUid, items }, flagged };
}
