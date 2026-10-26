import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { suggestionsDocRef } from '../lib/converters';
import type { SuggestionEntry, ShopEntry } from '../types/models';

const EMPTY_ITEMS: SuggestionEntry[] = [];
const EMPTY_SHOPS: ShopEntry[] = [];
const EMPTY_TAGS: ShopEntry[] = [];

type Loaded = { groupId: string; items: SuggestionEntry[]; shops: ShopEntry[]; tags: ShopEntry[] };

/**
 * The group's item, shop and tag suggestions, kept live with a Firestore listener so
 * a save always starts from the latest counts, including other members' saves.
 *
 * `loaded` stays false until the counts can be trusted as a baseline for a save:
 * a snapshot from the server, or a cached copy of the doc when offline. A cached
 * "no doc" may only mean the cache hasn't seen it yet, and after a listener error
 * the counts no longer update; saving from either would overwrite real counts.
 */
export function useItemSuggestions(groupId: string): [SuggestionEntry[], ShopEntry[], boolean, ShopEntry[]] {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      suggestionsDocRef(groupId),
      { includeMetadataChanges: true },
      (snap) => {
        if (!snap.exists() && snap.metadata.fromCache) return;
        const data = snap.exists() ? snap.data() : null;
        setLoaded({ groupId, items: data?.items ?? EMPTY_ITEMS, shops: data?.shops ?? EMPTY_SHOPS, tags: data?.tags ?? EMPTY_TAGS });
      },
      // An error ends the listener, so earlier counts would never update again.
      // Not loaded: saves then skip the suggestions update.
      () => setLoaded(null),
    );
    return () => {
      unsubscribe();
      // Switching back to this group must wait for a fresh snapshot.
      setLoaded(null);
    };
  }, [groupId]);

  // Derived from the stored key, so a group switch never shows the old group's lists.
  return loaded?.groupId === groupId
    ? [loaded.items, loaded.shops, true, loaded.tags]
    : [EMPTY_ITEMS, EMPTY_SHOPS, false, EMPTY_TAGS];
}
