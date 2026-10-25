import { serverTimestamp, type WithFieldValue, type WriteBatch } from 'firebase/firestore';
import { suggestionsDocRef } from './converters';
import { computeShopsDelta, computeSuggestionsDelta, type ItemInput, type SuggestionLists } from './suggestions';
import type { SuggestionsDoc } from '../types/models';

export type { SuggestionLists };
export interface SuggestionChange { items: ItemInput[]; shops: string[] }

/**
 * Adds the group's updated suggestions to `batch`, so they commit with the
 * expense write that changed them, and returns the new lists. Mounted
 * `useItemSuggestions` hooks pick the write up through their listener.
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
  stageSuggestions(batch, groupId, next);
  return next;
}

/** Adds a write to `batch` that replaces the group's suggestions with `lists`. */
export function stageSuggestions(batch: WriteBatch, groupId: string, lists: SuggestionLists): void {
  batch.set(suggestionsDocRef(groupId), { ...lists, updatedAt: serverTimestamp() } as WithFieldValue<SuggestionsDoc>);
}
