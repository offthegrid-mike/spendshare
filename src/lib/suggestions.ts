import type { ExpenseDoc, ItemDoc, LastPrice, SuggestionEntry, ShopEntry } from '../types/models';
import { purchaseDate, unitPrice } from './priceHistory';
import { isRefund } from './refund';
import { expenseTags } from './tags';
import { collapseWhitespace, normalizeNameKey } from './textNormalize';

/** An item going into or out of the suggestions. `price` is what it cost, for items being added. */
export type ItemInput = { name: string; categoryId: string; category: string; price?: LastPrice };

/** What one of an item cost, for the suggestions; undefined when there is no price to speak of. */
export function priceInput(unit: number, shopName: string, date: string): LastPrice | undefined {
  return unit > 0 ? { unit, shop: collapseWhitespace(shopName), date } : undefined;
}

function makeKey(name: string, categoryId: string): string {
  return normalizeNameKey(name) + '|' + categoryId;
}

export function computeSuggestionsDelta(
  current: SuggestionEntry[],
  removed: ItemInput[],
  added: ItemInput[],
): SuggestionEntry[] {
  const map = new Map<string, SuggestionEntry>();
  for (const entry of current) {
    map.set(makeKey(entry.name, entry.categoryId), { ...entry });
  }

  for (const item of removed) {
    const key = makeKey(item.name, item.categoryId);
    const entry = map.get(key);
    if (entry) {
      entry.count -= 1;
      if (entry.count <= 0) map.delete(key);
    }
  }

  for (const item of added) {
    const key = makeKey(item.name, item.categoryId);
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.name = collapseWhitespace(item.name);     // most-recent casing wins
      existing.category = item.category;
      // The price only moves forward in time, so saving an older expense never replaces a newer one.
      if (item.price && (!existing.last || item.price.date >= existing.last.date)) existing.last = { ...item.price };
    } else {
      map.set(key, {
        name: collapseWhitespace(item.name),
        categoryId: item.categoryId,
        category: item.category,
        count: 1,
        ...(item.price ? { last: { ...item.price } } : {}),
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function computeShopsDelta(
  current: ShopEntry[],
  removed: string[],
  added: string[],
): ShopEntry[] {
  const map = new Map<string, ShopEntry>();
  for (const entry of current) {
    map.set(normalizeNameKey(entry.name), { ...entry });
  }

  for (const name of removed) {
    const key = normalizeNameKey(name);
    const entry = map.get(key);
    if (entry) {
      entry.count -= 1;
      if (entry.count <= 0) map.delete(key);
    }
  }

  for (const name of added) {
    const key = normalizeNameKey(name);
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.name = collapseWhitespace(name);
    } else {
      map.set(key, { name: collapseWhitespace(name), count: 1 });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/** The newest price recorded for an item name, across its categories; null when none has one. */
export function lastPriceFor(suggestions: SuggestionEntry[], name: string): LastPrice | null {
  const key = normalizeNameKey(name);
  if (!key) return null;
  let newest: LastPrice | null = null;
  for (const entry of suggestions) {
    if (entry.last && normalizeNameKey(entry.name) === key && (!newest || entry.last.date > newest.date)) newest = entry.last;
  }
  return newest;
}

export interface SuggestionLists { items: SuggestionEntry[]; shops: ShopEntry[]; tags: ShopEntry[] }


/**
 * Recounts the suggestions from a group's whole history. Expenses are replayed
 * oldest first, so the newest casing and category name win, as they would have
 * if every expense had been added one at a time. Refunds return things already
 * counted, so they're left out, as they are when saved.
 */
export function recountSuggestions(
  expenses: ExpenseDoc[],
  itemsByExpense: Record<string, ItemDoc[]>,
): SuggestionLists {
  const oldestFirst = expenses
    .filter((exp) => !isRefund(exp))
    .sort((a, b) => a.date.toMillis() - b.date.toMillis());
  return {
    items: computeSuggestionsDelta([], [], oldestFirst.flatMap((exp) => {
      const date = purchaseDate(exp);
      return (itemsByExpense[exp.id] ?? []).map((item) => ({
        name: item.name,
        categoryId: item.categoryId,
        category: item.category,
        price: priceInput(unitPrice(item), exp.shopName, date),
      }));
    })),
    shops: computeShopsDelta([], [], oldestFirst.map((exp) => exp.shopName.trim()).filter(Boolean)),
    tags: computeShopsDelta([], [], oldestFirst.flatMap((exp) => expenseTags(itemsByExpense[exp.id] ?? []))),
  };
}

/** How many item and shop entries were added, removed, or changed in count, name, category name or last price. */
export function countSuggestionChanges(
  current: SuggestionLists,
  next: SuggestionLists,
): { items: number; shops: number; tags: number } {
  return {
    items: countChanged(current.items, next.items, (e) => makeKey(e.name, e.categoryId), (e) => `${e.count}|${e.name}|${e.category}|${e.last ? `${e.last.unit}|${e.last.shop}|${e.last.date}` : ''}`),
    shops: countChanged(current.shops, next.shops, (e) => normalizeNameKey(e.name), (e) => `${e.count}|${e.name}`),
    tags: countChanged(current.tags, next.tags, (e) => normalizeNameKey(e.name), (e) => `${e.count}|${e.name}`),
  };
}

function countChanged<T>(current: T[], next: T[], key: (entry: T) => string, value: (entry: T) => string): number {
  const before = new Map(current.map((e) => [key(e), value(e)]));
  const after = new Map(next.map((e) => [key(e), value(e)]));
  let changed = 0;
  for (const k of new Set([...before.keys(), ...after.keys()])) {
    if (before.get(k) !== after.get(k)) changed += 1;
  }
  return changed;
}
