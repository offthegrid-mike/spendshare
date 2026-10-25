import { serverTimestamp, type WithFieldValue, type WriteBatch } from 'firebase/firestore';
import { suggestionsDocRef } from './converters';
import { computeShopsDelta, computeSuggestionsDelta, type ItemInput } from './suggestions';
import type { ShopEntry, SuggestionEntry, SuggestionsDoc } from '../types/models';

export interface SuggestionLists { items: SuggestionEntry[]; shops: ShopEntry[] }
export interface SuggestionChange { items: ItemInput[]; shops: string[] }

/**
 * Adds the group's updated suggestions to `batch`, so they commit with the
 * expense write that changed them, and returns the new lists. After the batch
 * commits, pass them to `writeCache` so mounted hooks and the cache follow.
 */
export function stageSuggestionsUpdate(
  batch: WriteBatch,
  groupId: string,
  current: SuggestionLists,
  removed: SuggestionChange,
  added: SuggestionChange,
): SuggestionLists {
  const next = {
    items: computeSuggestionsDelta(current.items, removed.items, added.items),
    shops: computeShopsDelta(current.shops, removed.shops, added.shops),
  };
  batch.set(suggestionsDocRef(groupId), { ...next, updatedAt: serverTimestamp() } as WithFieldValue<SuggestionsDoc>);
  return next;
}
