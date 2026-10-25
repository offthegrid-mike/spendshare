import { describe, it, expect } from 'vitest';
import { categoriesBySpend, filterByCategory } from './filterByCategory';
import { makeExpense, makeItem } from '../../test/fixtures';

const woolies = makeExpense('e1', { shopName: 'Woolworths' });
const bunnings = makeExpense('e2', { shopName: 'Bunnings' });
const thai = makeExpense('e3', { shopName: 'Thai Riffic' });
const lonely = makeExpense('e4', { shopName: 'No items yet' });
const expenses = [woolies, bunnings, thai, lonely];
const itemsByExpense = {
  e1: [
    makeItem('i1', 'e1', { category: 'Groceries', amount: 3000 }),
    makeItem('i2', 'e1', { category: 'Household', amount: 500.4 }),
  ],
  e2: [makeItem('i3', 'e2', { category: 'Household', amount: 2143 })],
  e3: [makeItem('i4', 'e3', { category: 'Dining', amount: 4740 })],
};

describe('filterByCategory', () => {
  it('keeps the expenses with an item in the category, in their order', () => {
    expect(filterByCategory(expenses, itemsByExpense, 'Household').expenses.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(filterByCategory(expenses, itemsByExpense, 'Dining').expenses.map((e) => e.id)).toEqual(['e3']);
  });

  it('totals the category’s items only, rounded to whole cents', () => {
    expect(filterByCategory(expenses, itemsByExpense, 'Household').total).toBe(2643);
  });

  it('gives an expense that is all one category everything that was paid for it', () => {
    // Thai Riffic: 4740 of items, less a 740 gift card.
    const gifted = makeExpense('e3', { total: 4740, giftCardAmount: 740 });
    const { paidOf } = filterByCategory([gifted], { e3: itemsByExpense.e3 }, 'Dining');
    expect(paidOf).toEqual({ e3: 4000 });
  });

  it('splits what was paid between categories in proportion to their items', () => {
    // 4000 of items, less a 1000 gift card, leaves 3000 paid: a quarter of it for Household.
    const mixed = makeExpense('m', { total: 4000, giftCardAmount: 1000 });
    const mixedItems = {
      m: [
        makeItem('a', 'm', { category: 'Groceries', amount: 3000 }),
        makeItem('b', 'm', { category: 'Household', amount: 1000 }),
      ],
    };
    expect(filterByCategory([mixed], mixedItems, 'Household').paidOf).toEqual({ m: 750 });
    expect(filterByCategory([mixed], mixedItems, 'Groceries').paidOf).toEqual({ m: 2250 });
  });

  it('counts item amounts when there is nothing paid to split', () => {
    const free = makeExpense('f', { total: 0 });
    const result = filterByCategory([free], { f: [makeItem('a', 'f', { category: 'Groceries', amount: 0 })] }, 'Groceries');
    expect(result.paidOf).toEqual({ f: 0 });
  });

  it('matches blank categories as Uncategorized', () => {
    const blank = { e1: [makeItem('i1', 'e1', { category: '', amount: 700 })] };
    const result = filterByCategory(expenses, blank, 'Uncategorized');
    expect(result.expenses.map((e) => e.id)).toEqual(['e1']);
    expect(result.total).toBe(700);
  });

  it('never matches an expense whose items have not loaded', () => {
    expect(filterByCategory([lonely], {}, 'Groceries').expenses).toEqual([]);
  });

  it('is empty, with a zero total, for a category nothing has', () => {
    expect(filterByCategory(expenses, itemsByExpense, 'Travel')).toEqual({ expenses: [], paidOf: {}, total: 0 });
  });
});

describe('categoriesBySpend', () => {
  it('lists each category once, the biggest spend first', () => {
    expect(categoriesBySpend(Object.values(itemsByExpense).flat())).toEqual(['Dining', 'Groceries', 'Household']);
  });

  it('breaks a tie by name, and counts blank categories as Uncategorized', () => {
    expect(categoriesBySpend([
      makeItem('a', 'e1', { category: 'Beta', amount: 100 }),
      makeItem('b', 'e1', { category: '', amount: 100 }),
      makeItem('c', 'e1', { category: 'Alpha', amount: 100 }),
    ])).toEqual(['Alpha', 'Beta', 'Uncategorized']);
  });

  it('lists nothing for no items', () => {
    expect(categoriesBySpend([])).toEqual([]);
  });
});

describe('filterByCategory with refunds', () => {
  it('counts a refund against the category, as a negative amount paid', () => {
    const refund = makeExpense('r1', { shopName: 'Woolworths', total: 1000, kind: 'refund', refundOf: 'e1' });
    const result = filterByCategory(
      [woolies, refund],
      { ...itemsByExpense, r1: [makeItem('i9', 'r1', { category: 'Groceries', amount: 1000, refund: true })] },
      'Groceries',
    );
    expect(result.paidOf.r1).toBe(-1000);
    expect(result.total).toBe(2000);
  });
});
