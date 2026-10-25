import { describe, it, expect } from 'vitest';
import { computeMonthBreakdown, type MonthBreakdownInput } from './monthSummary';

const expenses = [
  { id: 'e1', shopName: 'Woolworths' },
  { id: 'e2', shopName: 'woolworths ' },
  { id: 'e3', shopName: 'Cafe Nero' },
];
const items = [
  { expenseId: 'e1', category: 'Groceries', amount: 6000 },
  { expenseId: 'e1', category: 'Household', amount: 1000 },
  { expenseId: 'e2', category: 'Groceries', amount: 3000 },
  { expenseId: 'e3', category: 'Dining', amount: 2000 },
];

function breakdown(over: Partial<MonthBreakdownInput> = {}) {
  return computeMonthBreakdown({
    items, expenses, income: [], prevItems: null, prevExpenses: [], prevThroughDay: null, daysElapsed: 10, ...over,
  });
}

/** An expense on a given day of the previous month, midday local time. */
const prevExpense = (id: string, day: number) => ({ id, date: { toDate: () => new Date(2026, 8, day, 12) } as never });

describe('computeMonthBreakdown totals', () => {
  it('sums spending and income, and what is left over', () => {
    const b = breakdown({ income: [{ amount: 20000 }, { amount: 10000 }] });
    expect(b.spent).toBe(12000);
    expect(b.income).toBe(30000);
    expect(b.saved).toBe(18000);
    expect(b.savingsRate).toBe(60);
  });

  it('has no savings rate without income, and a negative one when overspent', () => {
    expect(breakdown().savingsRate).toBeNull();
    expect(breakdown().saved).toBe(-12000);
    expect(breakdown({ income: [{ amount: 8000 }] }).savingsRate).toBe(-50);
  });

  it('averages per day over the days elapsed, or 0 when none have', () => {
    expect(breakdown({ daysElapsed: 10 }).dailyAverage).toBe(1200);
    expect(breakdown({ daysElapsed: 7 }).dailyAverage).toBe(1714);
    expect(breakdown({ daysElapsed: 0 }).dailyAverage).toBe(0);
  });

  it('is all zeros for an empty month', () => {
    const b = breakdown({ items: [], expenses: [] });
    expect(b).toMatchObject({
      spent: 0, income: 0, saved: 0, savingsRate: null, dailyAverage: 0,
      vsPrev: null, biggestExpense: null, categories: [], topShops: [],
    });
  });
});

describe('computeMonthBreakdown vs last month', () => {
  it('reports the rise or fall in spending against the previous month', () => {
    expect(breakdown({ prevItems: [{ expenseId: 'x', category: 'Groceries', amount: 10000 }] }).vsPrev)
      .toEqual({ amount: 2000, pct: 20 });
    expect(breakdown({ prevItems: [{ expenseId: 'x', category: 'Groceries', amount: 16000 }] }).vsPrev)
      .toEqual({ amount: -4000, pct: -25 });
  });

  it('has no comparison while the previous month loads, or when it had no spending', () => {
    expect(breakdown({ prevItems: null }).vsPrev).toBeNull();
    expect(breakdown({ prevItems: [] }).vsPrev).toBeNull();
  });

  it('shows each category’s change, and "new" for one the previous month lacked', () => {
    const b = breakdown({
      prevItems: [
        { expenseId: 'x', category: 'Groceries', amount: 6000 },
        { expenseId: 'x', category: 'Dining', amount: 4000 },
        { expenseId: 'x', category: 'Travel', amount: 5000 },
      ],
    });
    const by = Object.fromEntries(b.categories.map((c) => [c.category, c.change]));
    expect(by).toEqual({ Groceries: 50, Dining: -50, Household: 'new' });
  });

  it('has no category changes without a previous month to compare', () => {
    expect(breakdown({ prevItems: null }).categories.every((c) => c.change === null)).toBe(true);
    expect(breakdown({ prevItems: [] }).categories.every((c) => c.change === null)).toBe(true);
  });
});

describe('computeMonthBreakdown categories', () => {
  it('lists categories biggest first with their share of spending', () => {
    const b = breakdown();
    expect(b.categories.map(({ category, amount, pct }) => ({ category, amount, pct }))).toEqual([
      { category: 'Groceries', amount: 9000, pct: 75 },
      { category: 'Dining', amount: 2000, pct: (2000 / 12000) * 100 },
      { category: 'Household', amount: 1000, pct: (1000 / 12000) * 100 },
    ]);
  });
});

describe('computeMonthBreakdown shops and biggest expense', () => {
  it('ranks shops by spend, merging names that differ only by case or spacing', () => {
    const b = breakdown();
    expect(b.topShops).toEqual([
      { shopName: 'Woolworths', amount: 10000, visits: 2 },
      { shopName: 'Cafe Nero', amount: 2000, visits: 1 },
    ]);
  });

  it('keeps the top five shops only', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, shopName: `Shop ${i}` }));
    const manyItems = many.map((e, i) => ({ expenseId: e.id, category: 'Misc', amount: (i + 1) * 100 }));
    const b = breakdown({ items: manyItems, expenses: many });
    expect(b.topShops.map((s) => s.shopName)).toEqual(['Shop 6', 'Shop 5', 'Shop 4', 'Shop 3', 'Shop 2']);
  });

  it('counts spend on an expense it cannot find, but names no shop for it', () => {
    const b = breakdown({ items: [{ expenseId: 'ghost', category: 'Misc', amount: 500 }], expenses: [] });
    expect(b.spent).toBe(500);
    expect(b.topShops).toEqual([]);
    expect(b.biggestExpense).toBeNull();
  });

  it('names a shop for an expense saved without a name', () => {
    const b = breakdown({
      items: [{ expenseId: 'n', category: 'Misc', amount: 500 }],
      expenses: [{ id: 'n', shopName: '  ' }],
    });
    expect(b.topShops).toEqual([{ shopName: 'Unnamed shop', amount: 500, visits: 1 }]);
  });

  it('finds the single biggest expense by what its items add up to', () => {
    expect(breakdown().biggestExpense).toEqual({ shopName: 'Woolworths', amount: 7000 });
  });
});

describe('computeMonthBreakdown comparing a month still in progress', () => {
  // Last month: 16000 of Groceries on day 3, 4000 of Travel on day 20.
  const prevItems = [
    { expenseId: 'early', category: 'Groceries', amount: 16000 },
    { expenseId: 'late', category: 'Travel', amount: 4000 },
  ];
  const prevExpenses = [prevExpense('early', 3), prevExpense('late', 20)];

  it('sets spending beside what last month had spent by the same day, not all of it', () => {
    // By day 10 last month had spent 16000; this month's 12000 is 25% below that.
    const b = breakdown({ prevItems, prevExpenses, prevThroughDay: 10 });
    expect(b.vsPrev).toEqual({ amount: -4000, pct: -25 });
  });

  it('counts an expense on the cut-off day itself', () => {
    expect(breakdown({ prevItems, prevExpenses, prevThroughDay: 3 }).vsPrev).toEqual({ amount: -4000, pct: -25 });
    expect(breakdown({ prevItems, prevExpenses, prevThroughDay: 2 }).vsPrev).toBeNull();
  });

  it('compares each category the same way, without spreading lump payments across the month', () => {
    // Groceries was paid on day 3, so it counts in full by day 10; Travel hadn't happened yet.
    const by = Object.fromEntries(
      breakdown({ prevItems, prevExpenses, prevThroughDay: 10 }).categories.map((c) => [c.category, c.change]),
    );
    expect(by).toEqual({ Groceries: -43.75, Dining: 'new', Household: 'new' });
  });

  it('calls a category new when last month had not spent on it yet by that day', () => {
    // Last month's Travel was on day 20, past the cut-off.
    const travel = breakdown({
      items: [{ expenseId: 'e1', category: 'Travel', amount: 500 }],
      prevItems, prevExpenses, prevThroughDay: 10,
    });
    expect(travel.categories[0].change).toBe('new');
  });

  it('compares against all of last month when no cut-off applies, whatever day its expenses fell on', () => {
    expect(breakdown({ prevItems, prevExpenses, prevThroughDay: null }).vsPrev).toEqual({ amount: -8000, pct: -40 });
  });

  it('leaves out last month’s items it cannot date when a cut-off applies, but keeps them for the whole month', () => {
    const orphan = [{ expenseId: 'ghost', category: 'Groceries', amount: 10000 }];
    expect(breakdown({ prevItems: orphan, prevExpenses: [], prevThroughDay: 10 }).vsPrev).toBeNull();
    expect(breakdown({ prevItems: orphan, prevExpenses: [], prevThroughDay: null }).vsPrev)
      .toEqual({ amount: 2000, pct: 20 });
  });

  it('has no comparison when none of last month falls in the days compared', () => {
    expect(breakdown({ prevItems, prevExpenses, prevThroughDay: 0 }).vsPrev).toBeNull();
  });
});

describe('computeMonthBreakdown is steady however the data arrives', () => {
  it('names a merged shop after its biggest visit', () => {
    const b = breakdown({
      items: [...items].reverse(),
      expenses: [...expenses].reverse(),
    });
    expect(b.topShops[0]).toEqual({ shopName: 'Woolworths', amount: 10000, visits: 2 });
  });

  it('puts the shop with more visits first when spend is level, then goes by name', () => {
    const shopItems = [
      { expenseId: 'a1', category: 'Misc', amount: 500 },
      { expenseId: 'a2', category: 'Misc', amount: 500 },
      { expenseId: 'b1', category: 'Misc', amount: 1000 },
      { expenseId: 'c1', category: 'Misc', amount: 1000 },
    ];
    const shopExpenses = [
      { id: 'a1', shopName: 'Zed' }, { id: 'a2', shopName: 'Zed' },
      { id: 'b1', shopName: 'Beta' }, { id: 'c1', shopName: 'Alpha' },
    ];
    const names = (e: typeof shopExpenses, i: typeof shopItems) =>
      breakdown({ items: i, expenses: e }).topShops.map((s) => s.shopName);
    expect(names(shopExpenses, shopItems)).toEqual(['Zed', 'Alpha', 'Beta']);
    expect(names([...shopExpenses].reverse(), [...shopItems].reverse())).toEqual(['Zed', 'Alpha', 'Beta']);
  });

  it('gives a tie for the biggest expense to the shop that comes first by name', () => {
    const tied = [
      { expenseId: 'b', category: 'Misc', amount: 1000 },
      { expenseId: 'a', category: 'Misc', amount: 1000 },
    ];
    const tiedExpenses = [{ id: 'b', shopName: 'Beta' }, { id: 'a', shopName: 'Alpha' }];
    expect(breakdown({ items: tied, expenses: tiedExpenses }).biggestExpense?.shopName).toBe('Alpha');
    expect(breakdown({ items: [...tied].reverse(), expenses: [...tiedExpenses].reverse() }).biggestExpense?.shopName)
      .toBe('Alpha');
  });
});

describe('computeMonthBreakdown with refunds', () => {
  const withRefund = (over: Partial<MonthBreakdownInput> = {}) => breakdown({
    expenses: [...expenses, { id: 'r1', shopName: 'Woolworths', kind: 'refund' }],
    items: [...items, { expenseId: 'r1', category: 'Groceries', amount: 1500, refund: true }],
    ...over,
  });

  it('takes refunds off spending, the category and the shop', () => {
    const b = withRefund();
    expect(b.spent).toBe(10500);
    expect(b.categories.find((c) => c.category === 'Groceries')?.amount).toBe(7500);
    expect(b.topShops[0]).toEqual({ shopName: 'Woolworths', amount: 8500, visits: 2 });
  });

  it('never names a refund as the biggest expense', () => {
    const b = withRefund({
      expenses: [{ id: 'r1', shopName: 'Woolworths', kind: 'refund' }],
      items: [{ expenseId: 'r1', category: 'Groceries', amount: 1500, refund: true }],
    });
    expect(b.biggestExpense).toBeNull();
  });
});

describe('computeMonthBreakdown edge cases with refunds', () => {
  it("leaves a shop that only had a refund this month out of the top shops", () => {
    const b = breakdown({
      expenses: [...expenses, { id: 'r1', shopName: 'Aldi', kind: 'refund' }],
      items: [...items, { expenseId: 'r1', category: 'Groceries', amount: 500, refund: true }],
    });
    expect(b.topShops.map((s) => s.shopName)).not.toContain('Aldi');
  });

  it('treats a category that was refunded below zero last month as new, not as a percent change', () => {
    const b = breakdown({
      prevItems: [
        { expenseId: 'p1', category: 'Dining', amount: 3000 },
        { expenseId: 'p2', category: 'Groceries', amount: 500, refund: true },
      ],
    });
    expect(b.categories.find((c) => c.category === 'Groceries')?.change).toBe('new');
  });
});
