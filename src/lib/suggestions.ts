import type { SuggestionEntry } from '../types/models';

type ItemInput = { name: string; categoryId: string; category: string };

function makeKey(name: string, categoryId: string): string {
  return name.normalize('NFC').toLocaleLowerCase() + '|' + categoryId;
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
      existing.name = item.name;     // most-recent casing wins
      existing.category = item.category;
    } else {
      map.set(key, {
        name: item.name,
        categoryId: item.categoryId,
        category: item.category,
        count: 1,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
