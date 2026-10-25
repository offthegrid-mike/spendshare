import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { suggestionsDocRef } from '../lib/converters';
import type { SuggestionEntry, ShopEntry } from '../types/models';

const EMPTY_ITEMS: SuggestionEntry[] = [];
const EMPTY_SHOPS: ShopEntry[] = [];

type Loaded = { groupId: string; items: SuggestionEntry[]; shops: ShopEntry[] };

/**
 * The group's item and shop suggestions, kept live with a Firestore listener so
 * a save always starts from the latest counts, including other members' saves.
 *
 * `loaded` stays false until the counts can be trusted as a baseline for a save:
 * a snapshot from the server, or a cached copy of the doc when offline. A cached
 * "no doc" may only mean the cache hasn't seen it yet, and a listener error gives
 * no counts at all; saving from an empty list in either case would wipe them.
 */
export function useItemSuggestions(groupId: string): [SuggestionEntry[], ShopEntry[], boolean] {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    return onSnapshot(
      suggestionsDocRef(groupId),
      { includeMetadataChanges: true },
      (snap) => {
        if (!snap.exists() && snap.metadata.fromCache) return;
        const data = snap.exists() ? snap.data() : null;
        setLoaded({ groupId, items: data?.items ?? EMPTY_ITEMS, shops: data?.shops ?? EMPTY_SHOPS });
      },
      () => {
        // Leave it not loaded: saves then skip the suggestions update.
      },
    );
  }, [groupId]);

  // Derived from the stored key, so a group switch never shows the old group's lists.
  return loaded?.groupId === groupId ? [loaded.items, loaded.shops, true] : [EMPTY_ITEMS, EMPTY_SHOPS, false];
}
