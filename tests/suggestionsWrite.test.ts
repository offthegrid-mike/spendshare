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
  it('sets the new item and shop lists on the batch and returns them', () => {
    const set = vi.fn();
    const batch = { set } as unknown as WriteBatch;

    const next = stageSuggestionsUpdate(
      batch,
      'g1',
      { items: [milk, bread], shops: [woolies] },
      { items: [{ name: 'Bread', categoryId: 'cat1', category: 'Groceries' }], shops: ['Woolworths'] },
      { items: [{ name: 'Milk', categoryId: 'cat1', category: 'Groceries' }], shops: ['Coles'] },
    );

    expect(next).toEqual({
      items: [{ ...milk, count: 3 }],
      shops: [{ name: 'Coles', count: 1 }],
    });
    expect(set).toHaveBeenCalledWith(
      { path: 'groups/g1/suggestions/index' },
      { ...next, updatedAt: 'SERVER_TIMESTAMP' },
    );
  });

  it('stageSuggestions replaces the whole suggestions doc', () => {
    const set = vi.fn();
    const lists = { items: [milk], shops: [woolies] };
    stageSuggestions({ set } as unknown as WriteBatch, 'g1', lists);
    expect(set).toHaveBeenCalledWith(
      { path: 'groups/g1/suggestions/index' },
      { ...lists, updatedAt: 'SERVER_TIMESTAMP' },
    );
  });
});
