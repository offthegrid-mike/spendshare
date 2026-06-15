import { useEffect, useState } from 'react';
import { getDoc } from 'firebase/firestore';
import { suggestionsDocRef } from '../lib/converters';
import type { SuggestionEntry } from '../types/models';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(groupId: string) {
  return `suggestions_${groupId}`;
}

function readCache(groupId: string): SuggestionEntry[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(groupId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { items: SuggestionEntry[]; cachedAt: number };
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

export function writeCache(groupId: string, items: SuggestionEntry[]): void {
  try {
    localStorage.setItem(cacheKey(groupId), JSON.stringify({ items, cachedAt: Date.now() }));
  } catch {
    // ignore storage quota errors
  }
}

export function useItemSuggestions(groupId: string): SuggestionEntry[] {
  const [suggestions, setSuggestions] = useState<SuggestionEntry[]>([]);

  useEffect(() => {
    const cached = readCache(groupId);
    if (cached) {
      setSuggestions(cached);
      return;
    }
    getDoc(suggestionsDocRef(groupId))
      .then((snap) => {
        const items: SuggestionEntry[] = snap.exists() ? (snap.data().items ?? []) : [];
        setSuggestions(items);
        writeCache(groupId, items);
      })
      .catch(() => {
        // offline or permission error — stay empty, form still works
      });
  }, [groupId]);

  return suggestions;
}
