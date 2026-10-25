import { serverTimestamp, type WithFieldValue, type WriteBatch } from 'firebase/firestore';
import { suggestionsDocRef } from './converters';
import { computeShopsDelta, computeSuggestionsDelta, type ItemInput, type SuggestionLists } from './suggestions';
import type { SuggestionsDoc } from '../types/models';

export interface SuggestionChange { items: ItemInput[]; shops: string[] }

/**
 * Adds the group's updated suggestions to `batch`, so they commit with the
 * expense write that changed them. Mounted `useItemSuggestions` hooks pick
 * the write up through their listener.
 */
export function stageSuggestionsUpdate(
  batch: WriteBatch,
  groupId: string,
  current: SuggestionLists,
  removed: SuggestionChange,
  added: SuggestionChange,
): void {
  stageSuggestions(batch, groupId, {
    items: computeSuggestionsDelta(current.items, removed.items, added.items),
    shops: computeShopsDelta(current.shops, removed.shops, added.shops),
  });
}

/** Adds a write to `batch` that replaces the group's suggestions with `lists`. */
export function stageSuggestions(batch: WriteBatch, groupId: string, lists: SuggestionLists): void {
  batch.set(suggestionsDocRef(groupId), { ...lists, updatedAt: serverTimestamp() } as WithFieldValue<SuggestionsDoc>);
}
