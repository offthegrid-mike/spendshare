import { describe, it, expect } from 'vitest';
import { searchExpenses } from './search';
import type { ExpenseDoc, ItemDoc } from '../types/models';

function expense(id: string, shopName: string, dateMs: number | null): ExpenseDoc {
  return {
    id, shopName, groupId: 'g1', month: '2026-06', payerUid: 'u1',
    total: 1000, itemCount: 1, createdByUid: 'u1',
    date: dateMs === null ? null : { toMillis: () => dateMs },
    createdAt: null, updatedAt: null,
  } as unknown as ExpenseDoc;
}

function item(id: string, expenseId: string, name: string): ItemDoc {
  return {
    id, expenseId, name, groupId: 'g1', month: '2026-06',
    categoryId: 'c1', category: 'Food', amount: 500, shared: true, payerUid: 'u1',
  } as unknown as ItemDoc;
}

const woolies = expense('e1', 'Woolworths', 3000);
const cafe = expense('e2', 'Café Noël', 2000);
const wetMarket = expense('e3', '街市', 1000);

const expenses = [woolies, cafe, wetMarket];
const itemsByExpense = {
  e1: [item('i1', 'e1', 'Full cream milk'), item('i2', 'e1', 'Bananas')],
  e2: [item('i3', 'e2', 'Flat white')],
  e3: [item('i4', 'e3', '白菜'), item('i5', 'e3', '菜心')],
};

function ids(query: string): string[] {
  return searchExpenses(expenses, itemsByExpense, query).map((r) => r.expense.id);
}

describe('searchExpenses', () => {
  it('matches a shop name from the beginning', () => {
    expect(ids('Wool')).toEqual(['e1']);
  });

  it('matches a shop name from the middle', () => {
    expect(ids('worth')).toEqual(['e1']);
  });

  it('matches a shop name from the end', () => {
    expect(ids('ths')).toEqual(['e1']);
  });

  it('matches case-insensitively', () => {
    expect(ids('WOOLWORTHS')).toEqual(['e1']);
  });

  it('matches ignoring diacritics', () => {
    expect(ids('cafe noel')).toEqual(['e2']);
  });

  it('matches a Traditional Chinese shop name', () => {
    expect(ids('街市')).toEqual(['e3']);
  });

  it('matches a single Traditional Chinese character inside an item name', () => {
    expect(ids('菜')).toEqual(['e3']);
  });

  it('matches an item name from the middle', () => {
    expect(ids('cream')).toEqual(['e1']);
  });

  it('reports every matching item on an expense', () => {
    const [result] = searchExpenses(expenses, itemsByExpense, '菜');
    expect(result.matchedItems.map((i) => i.name)).toEqual(['白菜', '菜心']);
  });

  it('flags whether the shop name itself matched', () => {
    const [byShop] = searchExpenses(expenses, itemsByExpense, 'Woolworths');
    expect(byShop.shopMatch).toBe(true);
    expect(byShop.matchedItems).toEqual([]);

    const [byItem] = searchExpenses(expenses, itemsByExpense, 'Bananas');
    expect(byItem.shopMatch).toBe(false);
    expect(byItem.matchedItems.map((i) => i.name)).toEqual(['Bananas']);
  });

  it('returns nothing for an empty or whitespace-only query', () => {
    expect(ids('')).toEqual([]);
    expect(ids('   ')).toEqual([]);
  });

  it('returns nothing when nothing matches', () => {
    expect(ids('zzzz')).toEqual([]);
  });

  it('sorts results by date, most recent first', () => {
    const dated = [
      expense('old', 'Shop', 1000),
      expense('new', 'Shop', 3000),
      expense('mid', 'Shop', 2000),
    ];
    const results = searchExpenses(dated, {}, 'shop');
    expect(results.map((r) => r.expense.id)).toEqual(['new', 'mid', 'old']);
  });

  it('sorts expenses with no date last', () => {
    const mixed = [
      expense('undated', 'Shop', null),
      expense('old', 'Shop', 1000),
      expense('new', 'Shop', 3000),
    ];
    const results = searchExpenses(mixed, {}, 'shop');
    expect(results.map((r) => r.expense.id)).toEqual(['new', 'old', 'undated']);
  });

  it('does not match on item remarks or categories', () => {
    const withRemark = { ...item('i6', 'e1', 'Eggs'), remark: 'organic' } as ItemDoc;
    const results = searchExpenses([woolies], { e1: [withRemark] }, 'organic');
    expect(results).toEqual([]);
  });
});
