import type { ReactNode } from 'react';
import { createElement } from 'react';
import { normalizeNameKey } from '../../lib/textNormalize';

export const collator = new Intl.Collator(undefined, { sensitivity: 'base', usage: 'search' });

export function findMatchIndex(haystack: string, needle: string): number {
  const h = haystack.normalize('NFC');
  const n = needle.normalize('NFC');
  if (n.length === 0) return -1;
  for (let i = 0; i <= h.length - n.length; i++) {
    if (collator.compare(h.slice(i, i + n.length), n) === 0) return i;
  }
  return -1;
}

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
