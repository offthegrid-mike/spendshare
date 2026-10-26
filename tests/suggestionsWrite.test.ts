import { describe, it, expect, vi } from 'vitest';
import type { WriteBatch } from 'firebase/firestore';
import type { SuggestionEntry, ShopEntry } from '../src/types/models';

vi.mock('firebase/firestore', () => ({ serverTimestamp: () => 'SERVER_TIMESTAMP' }));
vi.mock('../src/lib/converters', () => ({
  suggestionsDocRef: (gid: string) => ({ path: `groups/${gid}/suggestions/index` }),
}));

import { stageSuggestions, stageSuggestionsUpdate } from '../src/lib/suggestionsWrite';

const milk: SuggestionEntry = { name: 'Milk', categoryId: 'cat1', category: 'Groceries', count: 2 };
const bread: SuggestionEntry = { name: 'Bread', categoryId: 'cat1', category: 'Groceries', count: 1 };
const woolies: ShopEntry = { name: 'Woolworths', count: 1 };

describe('stageSuggestionsUpdate', () => {
  it('sets the updated item and shop lists on the batch', () => {
    const set = vi.fn();
    const batch = { set } as unknown as WriteBatch;

    const result = stageSuggestionsUpdate(
      batch,
      'g1',
      { items: [milk, bread], shops: [woolies], tags: [] },
      { items: [{ name: 'Bread', categoryId: 'cat1', category: 'Groceries' }], shops: ['Woolworths'], tags: [] },
      { items: [{ name: 'Milk', categoryId: 'cat1', category: 'Groceries' }], shops: ['Coles'], tags: [] },
    );

    expect(result).toBeUndefined();
    expect(set).toHaveBeenCalledWith(
      { path: 'groups/g1/suggestions/index' },
      { items: [{ ...milk, count: 3 }], shops: [{ name: 'Coles', count: 1 }], tags: [], updatedAt: 'SERVER_TIMESTAMP' },
    );
  });

  it('moves tag counts with the change, so a save never drops them', () => {
    const set = vi.fn();
    stageSuggestionsUpdate(
      { set } as unknown as WriteBatch,
      'g1',
      { items: [], shops: [], tags: [{ name: 'Holiday', count: 2 }, { name: 'Snacks', count: 1 }] },
      { items: [], shops: [], tags: ['Snacks'] },
      { items: [], shops: [], tags: ['Holiday', 'Renovation'] },
    );
    expect(set.mock.calls[0][1].tags).toEqual([{ name: 'Holiday', count: 3 }, { name: 'Renovation', count: 1 }]);
  });

  it('stageSuggestions replaces the whole suggestions doc', () => {
    const set = vi.fn();
    const lists = { items: [milk], shops: [woolies], tags: [{ name: 'Holiday', count: 1 }] };
    stageSuggestions({ set } as unknown as WriteBatch, 'g1', lists);
    expect(set).toHaveBeenCalledWith(
      { path: 'groups/g1/suggestions/index' },
      { ...lists, updatedAt: 'SERVER_TIMESTAMP' },
    );
  });
});
