import { useEffect, useState } from 'react';
import { getDoc } from 'firebase/firestore';
import { suggestionsDocRef } from '../lib/converters';
import type { SuggestionEntry, ShopEntry } from '../types/models';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(groupId: string) {
  return `suggestions_${groupId}`;
}

type CacheData = { items: SuggestionEntry[]; shops: ShopEntry[] };

// Mounted hooks, by group, so a write reaches every component that already
// loaded the suggestions, not just the next one to read the cache.
const listeners = new Map<string, Set<(data: CacheData) => void>>();

function readCache(groupId: string): CacheData | null {
  try {
    const raw = localStorage.getItem(cacheKey(groupId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { items: unknown; shops?: ShopEntry[]; cachedAt: unknown };
    if (!Array.isArray(parsed.items)) return null;
    if (typeof parsed.cachedAt !== 'number' || isNaN(parsed.cachedAt)) return null;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return { items: parsed.items as SuggestionEntry[], shops: Array.isArray(parsed.shops) ? parsed.shops : [] };
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
  listeners.get(groupId)?.forEach((notify) => notify({ items, shops }));
}

export function useItemSuggestions(groupId: string): [SuggestionEntry[], ShopEntry[], boolean] {
  const [suggestions, setSuggestions] = useState<SuggestionEntry[]>([]);
  const [shops, setShops] = useState<ShopEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const onWrite = (data: CacheData) => {
      setSuggestions(data.items);
      setShops(data.shops);
      setLoaded(true);
    };
    const groupListeners = listeners.get(groupId) ?? new Set();
    listeners.set(groupId, groupListeners.add(onWrite));

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
      groupListeners.delete(onWrite);
      if (groupListeners.size === 0) listeners.delete(groupId);
    };
  }, [groupId]);

  return [suggestions, shops, loaded];
}
