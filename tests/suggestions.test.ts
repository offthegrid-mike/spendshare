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

import { countSuggestionChanges, lastPriceFor, recountSuggestions } from '../src/lib/suggestions';
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
      { name: 'Milk', categoryId: 'cat1', category: 'Groceries', count: 2, last: { unit: 1000, shop: 'woolworths', date: '2026-10-05' } },
      { name: 'Bread', categoryId: 'cat1', category: 'Dairy', count: 1, last: { unit: 1000, shop: 'Woolworths', date: '2026-10-01' } },
      { name: 'Milk', categoryId: 'cat2', category: 'Other', count: 1, last: { unit: 1000, shop: '', date: '2026-10-02' } },
    ]);
    expect(shops).toEqual([{ name: 'woolworths', count: 2 }]);
  });

  it('gives empty lists for an empty history', () => {
    expect(recountSuggestions([], {})).toEqual({ items: [], shops: [], tags: [] });
  });
});

describe('countSuggestionChanges', () => {
  const current = {
    items: [milk, bread],
    shops: [{ name: 'Coles', count: 2 }, { name: 'Aldi', count: 1 }],
    tags: [],
  };

  it('is zero when the lists hold the same entries in another order', () => {
    const same = {
      items: [{ ...bread }, { ...milk }],
      shops: [{ name: 'Aldi', count: 1 }, { name: 'Coles', count: 2 }],
      tags: [],
    };
    expect(countSuggestionChanges(current, same)).toEqual({ items: 0, shops: 0, tags: 0 });
  });

  it('counts a changed name casing or category name as a change', () => {
    const renamed = {
      items: [{ ...milk, name: 'MILK' }, { ...bread, category: 'Bakery' }],
      shops: [{ name: 'aldi', count: 1 }, { name: 'Coles', count: 2 }],
      tags: [],
    };
    expect(countSuggestionChanges(current, renamed)).toEqual({ items: 2, shops: 1, tags: 0 });
  });

  it('counts entries that were added, removed or changed', () => {
    const next = {
      items: [{ ...milk, count: 1 }, { name: 'Eggs', categoryId: 'cat1', category: 'Groceries', count: 1 }],
      shops: [{ name: 'Coles', count: 2 }],
      tags: [],
    };
    expect(countSuggestionChanges(current, next)).toEqual({ items: 3, shops: 1, tags: 0 });
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
    expect(items).toEqual([{ name: 'Milk', categoryId: 'cat1', category: 'Dairy', count: 1, last: { unit: 1000, shop: 'Coles', date: '2026-10-01' } }]);
    expect(shops).toEqual([{ name: 'Coles', count: 1 }]);
  });
});

describe('suggestions with tags', () => {
  it('counts each tag once per expense, newest spelling first, refunds left out', () => {
    const older = makeExpense('e1', { shopName: 'Coles', day: '2026-10-01' });
    const newer = makeExpense('e2', { shopName: 'Coles', day: '2026-10-03' });
    const refund = makeExpense('r1', { shopName: 'Coles', day: '2026-10-04', kind: 'refund', refundOf: 'e1' });
    const { tags } = recountSuggestions([refund, newer, older], {
      e1: [
        makeItem('i1', 'e1', { tags: ['holiday'] }),
        makeItem('i2', 'e1', { tags: ['Holiday', 'Snacks'] }),
      ],
      e2: [makeItem('i3', 'e2', { tags: ['Holiday'] })],
      r1: [makeItem('i4', 'r1', { refund: true, tags: ['Holiday'] })],
    });
    expect(tags).toEqual([{ name: 'Holiday', count: 2 }, { name: 'Snacks', count: 1 }]);
  });

  it('counts tag differences as changes', () => {
    const lists = (tags: { name: string; count: number }[]) => ({ items: [], shops: [], tags });
    expect(countSuggestionChanges(lists([{ name: 'Holiday', count: 2 }]), lists([{ name: 'Holiday', count: 2 }]))).toEqual({ items: 0, shops: 0, tags: 0 });
    expect(countSuggestionChanges(lists([{ name: 'Holiday', count: 2 }]), lists([{ name: 'Holiday', count: 1 }, { name: 'Snacks', count: 1 }]))).toEqual({ items: 0, shops: 0, tags: 2 });
  });
});

describe('suggestions with last prices', () => {
  const price = (unit: number, shop: string, date: string) => ({ unit, shop, date });
  const milkAt = (unit: number, shop: string, date: string) => ({
    name: 'Milk', categoryId: 'cat1', category: 'Groceries', price: price(unit, shop, date),
  });

  it('records the price a new entry was last bought at', () => {
    const [entry] = computeSuggestionsDelta([], [], [milkAt(350, 'Coles', '2026-10-12')]);
    expect(entry.last).toEqual(price(350, 'Coles', '2026-10-12'));
  });

  it('moves the price on to a newer purchase', () => {
    const current = [{ ...milk, last: price(350, 'Coles', '2026-10-12') }];
    const [entry] = computeSuggestionsDelta(current, [], [milkAt(380, 'Aldi', '2026-10-20')]);
    expect(entry.last).toEqual(price(380, 'Aldi', '2026-10-20'));
  });

  it('keeps a newer price when an older purchase is saved later', () => {
    const current = [{ ...milk, last: price(350, 'Coles', '2026-10-12') }];
    const [entry] = computeSuggestionsDelta(current, [], [milkAt(300, 'Aldi', '2026-09-01')]);
    expect(entry.last).toEqual(price(350, 'Coles', '2026-10-12'));
    expect(entry.count).toBe(4);
  });

  it('lets a purchase on the same day replace the price, so an edit takes effect', () => {
    const current = [{ ...milk, last: price(350, 'Coles', '2026-10-12') }];
    const [entry] = computeSuggestionsDelta(current, [milkAt(350, 'Coles', '2026-10-12')], [milkAt(340, 'Coles', '2026-10-12')]);
    expect(entry.last).toEqual(price(340, 'Coles', '2026-10-12'));
    expect(entry.count).toBe(3);
  });

  it('prices an old entry that had none once it is bought again', () => {
    const [entry] = computeSuggestionsDelta([milk], [], [milkAt(350, 'Coles', '2026-10-12')]);
    expect(entry.last).toEqual(price(350, 'Coles', '2026-10-12'));
  });

  it('leaves the price alone when an item with no price is added or removed', () => {
    const current = [{ ...milk, last: price(350, 'Coles', '2026-10-12') }];
    const bare = { name: 'Milk', categoryId: 'cat1', category: 'Groceries' };
    expect(computeSuggestionsDelta(current, [], [bare])[0].last).toEqual(price(350, 'Coles', '2026-10-12'));
    expect(computeSuggestionsDelta(current, [bare], [])[0].last).toEqual(price(350, 'Coles', '2026-10-12'));
  });

  it('never writes a last key it has no price for, since Firestore refuses undefined', () => {
    const [entry] = computeSuggestionsDelta([], [], [{ name: 'Milk', categoryId: 'cat1', category: 'Groceries' }]);
    expect('last' in entry).toBe(false);
  });

  describe('recountSuggestions', () => {
    it('takes the price from the newest purchase, per unit, with its shop and day', () => {
      const old = makeExpense('e1', { shopName: 'Coles', day: '2026-09-01' });
      const recent = makeExpense('e2', { shopName: ' Aldi  ', day: '2026-10-12' });
      const { items } = recountSuggestions([recent, old], {
        e1: [makeItem('i1', 'e1', { name: 'Milk', amount: 310 })],
        e2: [makeItem('i2', 'e2', { name: 'Milk', amount: 700, quantity: 2, unitAmount: 350 })],
      });
      expect(items[0].last).toEqual(price(350, 'Aldi', '2026-10-12'));
    });

    it('leaves out refunds and items with no price', () => {
      const bought = makeExpense('e1', { shopName: 'Coles', day: '2026-10-01' });
      const free = makeExpense('e2', { shopName: 'Aldi', day: '2026-10-05' });
      const refund = makeExpense('r1', { shopName: 'Coles', day: '2026-10-09', kind: 'refund', refundOf: 'e1' });
      const { items } = recountSuggestions([refund, free, bought], {
        e1: [makeItem('i1', 'e1', { name: 'Milk', amount: 310 })],
        e2: [makeItem('i2', 'e2', { name: 'Milk', amount: 0 })],
        r1: [makeItem('i3', 'r1', { name: 'Milk', amount: 310, refund: true })],
      });
      expect(items[0]).toMatchObject({ count: 2, last: price(310, 'Coles', '2026-10-01') });
    });

    it('has no price for an entry none of whose purchases had one', () => {
      const free = makeExpense('e1', { day: '2026-10-05' });
      const { items } = recountSuggestions([free], { e1: [makeItem('i1', 'e1', { name: 'Sample', amount: 0 })] });
      expect('last' in items[0]).toBe(false);
    });
  });

  describe('countSuggestionChanges', () => {
    const lists = (last?: ReturnType<typeof price>) => ({
      items: [{ ...milk, ...(last ? { last } : {}) }], shops: [], tags: [],
    });

    it('counts a changed price as a change', () => {
      const a = lists(price(350, 'Coles', '2026-10-12'));
      expect(countSuggestionChanges(a, lists(price(350, 'Coles', '2026-10-12')))).toEqual({ items: 0, shops: 0, tags: 0 });
      expect(countSuggestionChanges(a, lists(price(360, 'Coles', '2026-10-12')))).toEqual({ items: 1, shops: 0, tags: 0 });
      expect(countSuggestionChanges(a, lists(price(350, 'Aldi', '2026-10-12')))).toEqual({ items: 1, shops: 0, tags: 0 });
      expect(countSuggestionChanges(a, lists(price(350, 'Coles', '2026-10-13')))).toEqual({ items: 1, shops: 0, tags: 0 });
    });

    it('counts a price that was missing as a change', () => {
      expect(countSuggestionChanges(lists(), lists(price(350, 'Coles', '2026-10-12')))).toEqual({ items: 1, shops: 0, tags: 0 });
    });
  });

  describe('lastPriceFor', () => {
    const entries = [
      { ...milk, last: price(350, 'Coles', '2026-10-12') },
      { name: 'MILK ', categoryId: 'cat2', category: 'Other', count: 1, last: price(380, 'Aldi', '2026-10-20') },
      { name: 'Milk', categoryId: 'cat3', category: 'Misc', count: 1 },
      { ...bread, last: price(500, 'Coles', '2026-10-25') },
    ];

    it('is the newest price among the entries with that name, whatever the case or spacing', () => {
      expect(lastPriceFor(entries, ' milk')).toEqual(price(380, 'Aldi', '2026-10-20'));
    });

    it('is null for a name with no price, or no entry', () => {
      expect(lastPriceFor(entries, 'Eggs')).toBeNull();
      expect(lastPriceFor([{ ...milk }], 'Milk')).toBeNull();
      expect(lastPriceFor(entries, '  ')).toBeNull();
    });
  });
});
