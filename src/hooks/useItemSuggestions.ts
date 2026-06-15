import { useEffect, useState } from 'react';
import { getDoc } from 'firebase/firestore';
import { suggestionsDocRef } from '../lib/converters';
import type { SuggestionEntry, ShopEntry } from '../types/models';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(groupId: string) {
  return `suggestions_${groupId}`;
}

type CacheData = { items: SuggestionEntry[]; shops: ShopEntry[] };

function readCache(groupId: string): CacheData | null {
  try {
    const raw = localStorage.getItem(cacheKey(groupId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { items: SuggestionEntry[]; shops?: ShopEntry[]; cachedAt: number };
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return { items: parsed.items, shops: parsed.shops ?? [] };
  } catch {
    return null;
  }
}

export function writeCache(groupId: string, items: SuggestionEntry[], shops: ShopEntry[]): void {
  try {
    localStorage.setItem(cacheKey(groupId), JSON.stringify({ items, shops, cachedAt: Date.now() }));
  } catch {
    // ignore storage quota errors
  }
}

export function useItemSuggestions(groupId: string): [SuggestionEntry[], ShopEntry[], boolean] {
  const [suggestions, setSuggestions] = useState<SuggestionEntry[]>([]);
  const [shops, setShops] = useState<ShopEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const cached = readCache(groupId);
    const load: Promise<CacheData> = cached
      ? Promise.resolve(cached)
      : getDoc(suggestionsDocRef(groupId)).then((snap) => {
          const items: SuggestionEntry[] = snap.exists() ? (snap.data().items ?? []) : [];
          const shopList: ShopEntry[] = snap.exists() ? (snap.data().shops ?? []) : [];
          writeCache(groupId, items, shopList);
          return { items, shops: shopList };
        });

    load
      .then((data) => {
        if (!cancelled) {
          setSuggestions(data.items);
          setShops(data.shops);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  return [suggestions, shops, loaded];
}
