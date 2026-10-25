import { describe, it, expect } from 'vitest';
import { computeSuggestionsDelta } from '../src/lib/suggestions';
import type { SuggestionEntry } from '../src/types/models';

const milk: SuggestionEntry = { name: 'Milk', categoryId: 'cat1', category: 'Groceries', count: 3 };
const bread: SuggestionEntry = { name: 'Bread', categoryId: 'cat1', category: 'Groceries', count: 1 };

describe('computeSuggestionsDelta', () => {
  it('adds new entries at count 1 on create (empty current)', () => {
    const result = computeSuggestionsDelta([], [], [
      { name: 'Milk', categoryId: 'cat1', category: 'Groceries' },
    ]);
    expect(result).toEqual([
      { name: 'Milk', categoryId: 'cat1', category: 'Groceries', count: 1 },
    ]);
  });

  it('increments count for an existing entry', () => {
    const result = computeSuggestionsDelta([milk], [], [
      { name: 'Milk', categoryId: 'cat1', category: 'Groceries' },
    ]);
    expect(result[0].count).toBe(4);
  });

  it('decrements count for removed entries', () => {
    const result = computeSuggestionsDelta([milk, bread], [
      { name: 'Milk', categoryId: 'cat1', category: 'Groceries' },
    ], []);
    const m = result.find((e) => e.name === 'Milk');
    expect(m?.count).toBe(2);
  });

  it('removes entries when count reaches zero', () => {
    const result = computeSuggestionsDelta([bread], [
      { name: 'Bread', categoryId: 'cat1', category: 'Groceries' },
    ], []);
    expect(result.find((e) => e.name === 'Bread')).toBeUndefined();
  });

  it('is case-insensitive for deduplication; most-recent casing wins', () => {
    const result = computeSuggestionsDelta([milk], [], [
      { name: 'milk', categoryId: 'cat1', category: 'Groceries' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(4);
    expect(result[0].name).toBe('milk');
  });

  it('NFC-normalises before dedup: composed vs decomposed é merge', () => {
    const composed = 'café';    // café — é as single code point
    const decomposed = 'café'; // café — e + combining acute
    const existing: SuggestionEntry = {
      name: composed, categoryId: 'cat1', category: 'Dining', count: 1,
    };
    const result = computeSuggestionsDelta([existing], [], [
      { name: decomposed, categoryId: 'cat1', category: 'Dining' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
  });

  it('collapses whitespace before dedup: internal double-space and trailing space merge', () => {
    const result = computeSuggestionsDelta([milk], [], [
      { name: 'Milk ', categoryId: 'cat1', category: 'Groceries' },
      { name: 'Milk',  categoryId: 'cat1', category: 'Groceries' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(5);
    expect(result[0].name).toBe('Milk');
  });

  it('stores a whitespace-collapsed name even for a brand-new entry', () => {
    const result = computeSuggestionsDelta([], [], [
      { name: 'Chinese  cabbage ', categoryId: 'cat1', category: 'Groceries' },
    ]);
    expect(result[0].name).toBe('Chinese cabbage');
  });

  it('treats same name with different categoryId as distinct entries', () => {
    const result = computeSuggestionsDelta([milk], [], [
      { name: 'Milk', categoryId: 'cat2', category: 'Dairy' },
    ]);
    expect(result).toHaveLength(2);
  });

  it('returns entries sorted by count descending', () => {
    const result = computeSuggestionsDelta([milk, bread], [], [
      { name: 'Bread', categoryId: 'cat1', category: 'Groceries' },
    ]);
    expect(result[0].name).toBe('Milk');
    expect(result[1].name).toBe('Bread');
  });

  it('handles simultaneous remove-old and add-new on update', () => {
    const result = computeSuggestionsDelta([milk], [
      { name: 'Milk', categoryId: 'cat1', category: 'Groceries' },
    ], [
      { name: 'Eggs', categoryId: 'cat1', category: 'Groceries' },
    ]);
    expect(result.find((e) => e.name === 'Milk')?.count).toBe(2);
    expect(result.find((e) => e.name === 'Eggs')?.count).toBe(1);
  });
});

import { computeShopsDelta } from '../src/lib/suggestions';
import type { ShopEntry } from '../src/types/models';

describe('computeShopsDelta', () => {
  it('adds a new shop at count 1', () => {
    const result = computeShopsDelta([], [], ['Woolworths']);
    expect(result).toEqual([{ name: 'Woolworths', count: 1 }]);
  });

  it('increments count for an existing shop', () => {
    const current: ShopEntry[] = [{ name: 'Woolworths', count: 3 }];
    const result = computeShopsDelta(current, [], ['Woolworths']);
    expect(result[0].count).toBe(4);
  });

  it('decrements count for removed shop', () => {
    const current: ShopEntry[] = [{ name: 'Woolworths', count: 2 }];
    const result = computeShopsDelta(current, ['Woolworths'], []);
    expect(result[0].count).toBe(1);
  });

  it('removes shop when count reaches zero', () => {
    const current: ShopEntry[] = [{ name: 'Woolworths', count: 1 }];
    const result = computeShopsDelta(current, ['Woolworths'], []);
    expect(result.find((s) => s.name === 'Woolworths')).toBeUndefined();
  });

  it('is case-insensitive; most-recent casing wins', () => {
    const current: ShopEntry[] = [{ name: 'ALDI', count: 1 }];
    const result = computeShopsDelta(current, [], ['aldi']);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
    expect(result[0].name).toBe('aldi');
  });

  it('handles simultaneous remove-old and add-new on edit', () => {
    const current: ShopEntry[] = [{ name: 'Coles', count: 2 }];
    const result = computeShopsDelta(current, ['Coles'], ['Woolworths']);
    expect(result.find((s) => s.name === 'Coles')?.count).toBe(1);
    expect(result.find((s) => s.name === 'Woolworths')?.count).toBe(1);
  });

  it('returns entries sorted by count descending', () => {
    const current: ShopEntry[] = [
      { name: 'Woolworths', count: 5 },
      { name: 'Coles', count: 2 },
    ];
    const result = computeShopsDelta(current, [], ['Coles']);
    expect(result[0].name).toBe('Woolworths');
    expect(result[1].name).toBe('Coles');
  });
});

import { countSuggestionChanges, recountSuggestions } from '../src/lib/suggestions';
import { makeExpense, makeItem } from '../src/test/fixtures';

describe('recountSuggestions', () => {
  // Newest first, as useAllExpenses returns them.
  const newer = makeExpense('e2', { shopName: 'woolworths ', day: '2026-10-05' });
  const older = makeExpense('e1', { shopName: 'Woolworths', day: '2026-10-01' });
  const blankShop = makeExpense('e3', { shopName: '  ', day: '2026-10-02' });
  const itemsByExpense = {
    e1: [makeItem('i1', 'e1', { name: 'milk', categoryId: 'cat1', category: 'Dairy' }), makeItem('i2', 'e1', { name: 'Bread', categoryId: 'cat1', category: 'Dairy' })],
    e2: [makeItem('i3', 'e2', { name: 'Milk ', categoryId: 'cat1', category: 'Groceries' })],
    e3: [makeItem('i4', 'e3', { name: 'Milk', categoryId: 'cat2', category: 'Other' })],
  };

  it('counts every item and shop across the history', () => {
    const { items, shops } = recountSuggestions([newer, blankShop, older], itemsByExpense);
    expect(items).toEqual([
      { name: 'Milk', categoryId: 'cat1', category: 'Groceries', count: 2 },
      { name: 'Bread', categoryId: 'cat1', category: 'Dairy', count: 1 },
      { name: 'Milk', categoryId: 'cat2', category: 'Other', count: 1 },
    ]);
    expect(shops).toEqual([{ name: 'woolworths', count: 2 }]);
  });

  it('gives empty lists for an empty history', () => {
    expect(recountSuggestions([], {})).toEqual({ items: [], shops: [] });
  });
});

describe('countSuggestionChanges', () => {
  const current = {
    items: [milk, bread],
    shops: [{ name: 'Coles', count: 2 }, { name: 'Aldi', count: 1 }],
  };

  it('is zero when the lists hold the same entries in another order', () => {
    const same = {
      items: [{ ...bread }, { ...milk }],
      shops: [{ name: 'Aldi', count: 1 }, { name: 'Coles', count: 2 }],
    };
    expect(countSuggestionChanges(current, same)).toEqual({ items: 0, shops: 0 });
  });

  it('counts a changed name casing or category name as a change', () => {
    const renamed = {
      items: [{ ...milk, name: 'MILK' }, { ...bread, category: 'Bakery' }],
      shops: [{ name: 'aldi', count: 1 }, { name: 'Coles', count: 2 }],
    };
    expect(countSuggestionChanges(current, renamed)).toEqual({ items: 2, shops: 1 });
  });

  it('counts entries that were added, removed or changed', () => {
    const next = {
      items: [{ ...milk, count: 1 }, { name: 'Eggs', categoryId: 'cat1', category: 'Groceries', count: 1 }],
      shops: [{ name: 'Coles', count: 2 }],
    };
    expect(countSuggestionChanges(current, next)).toEqual({ items: 3, shops: 1 });
  });
});

describe('recountSuggestions with refunds', () => {
  it('leaves refunds out: they return things already counted', () => {
    const bought = makeExpense('e1', { shopName: 'Coles', day: '2026-10-01' });
    const refund = makeExpense('r1', { shopName: 'Coles', day: '2026-10-02', kind: 'refund', refundOf: 'e1' });
    const { items, shops } = recountSuggestions([refund, bought], {
      e1: [makeItem('i1', 'e1', { name: 'Milk', categoryId: 'cat1', category: 'Dairy' })],
      r1: [makeItem('i2', 'r1', { name: 'Milk', categoryId: 'cat1', category: 'Dairy', refund: true })],
    });
    expect(items).toEqual([{ name: 'Milk', categoryId: 'cat1', category: 'Dairy', count: 1 }]);
    expect(shops).toEqual([{ name: 'Coles', count: 1 }]);
  });
});
