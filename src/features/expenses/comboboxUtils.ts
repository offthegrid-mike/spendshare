import { findMatchIndex } from '../../lib/search';
import { normalizeNameKey } from '../../lib/textNormalize';

export { collator, findMatchIndex, highlightMatch } from '../../lib/search';

/**
 * Filters entries matching `query` by name, then dedupes entries whose names
 * differ only by case/diacritics (e.g. the same item name under two
 * categories), keeping the highest-count entry per name, and returns the
 * top `limit` by count.
 */
export function dedupeByName<T extends { name: string; count: number }>(
  entries: T[],
  query: string,
  limit = 5,
): T[] {
  const byName = new Map<string, T>();
  for (const entry of entries) {
    if (findMatchIndex(entry.name, query) === -1) continue;
    const key = normalizeNameKey(entry.name);
    const existing = byName.get(key);
    if (!existing || entry.count > existing.count) byName.set(key, entry);
  }
  return Array.from(byName.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
