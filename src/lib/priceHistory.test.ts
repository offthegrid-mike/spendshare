import { describe, it, expect } from 'vitest';
import { canLinkPrices, computePriceHistory, formatLastPrice, priceSeries, purchaseDate, unitPrice } from './priceHistory';
import { makeExpense, makeItem } from '../test/fixtures';
import type { ExpenseDoc, ItemDoc } from '../types/models';

/** One purchase of `name`: an expense on `day` at `shop`, with a single item of `unit` cents. */
function buy(id: string, day: string, shop: string, unit: number, over: Partial<ItemDoc> = {}, exp: Partial<ExpenseDoc> = {}) {
  return {
    expense: makeExpense(id, { day, shopName: shop, ...exp }),
    items: [makeItem(`${id}-i`, id, { name: 'Milk 2L', amount: unit, ...over })],
  };
}

function history(name: string, purchases: ReturnType<typeof buy>[]) {
  return computePriceHistory(
    name,
    purchases.map((p) => p.expense),
    Object.fromEntries(purchases.map((p) => [p.expense.id, p.items])),
  );
}

describe('unitPrice', () => {
  it('uses the stored unit price', () => {
    expect(unitPrice({ amount: 700, quantity: 2, unitAmount: 350 })).toBe(350);
  });

  it('divides the line total by the quantity, rounded, when there is no unit price', () => {
    expect(unitPrice({ amount: 1000, quantity: 3 })).toBe(333);
    expect(unitPrice({ amount: 1000 })).toBe(1000);
  });

  it('falls back to the line total when the stored unit price is not usable', () => {
    expect(unitPrice({ amount: 500, unitAmount: 0 })).toBe(500);
  });

  it('is 0 when there is no price to speak of', () => {
    expect(unitPrice({ amount: 0 })).toBe(0);
    expect(unitPrice({ amount: -200 })).toBe(0);
  });
});

describe('purchaseDate', () => {
  it('is the expense date as YYYY-MM-DD', () => {
    expect(purchaseDate(makeExpense('e1', { day: '2026-10-12' }))).toBe('2026-10-12');
    expect(purchaseDate(makeExpense('e2', { day: '2026-01-05' }))).toBe('2026-01-05');
  });
});

describe('computePriceHistory items', () => {
  it('matches the name exactly once case and spacing are set aside', () => {
    const h = history(' milk  2l ', [
      buy('a', '2026-10-01', 'Coles', 350),
      buy('b', '2026-10-02', 'Coles', 360, { name: 'MILK 2l' }),
      buy('c', '2026-10-03', 'Coles', 999, { name: 'Milk 2 L full cream' }),
      buy('d', '2026-10-04', 'Coles', 999, { name: 'Milk' }),
    ]);
    expect(h.points.map((p) => p.expenseId)).toEqual(['a', 'b']);
  });

  it('is empty for an item never bought', () => {
    expect(history('Saffron', [buy('a', '2026-10-01', 'Coles', 350)])).toEqual({
      name: 'Saffron', points: [], latest: null, shops: [], changes: [],
    });
  });

  it('lists purchases oldest first, with the shop and unit price', () => {
    const h = history('Milk 2L', [buy('b', '2026-10-12', 'Aldi', 360), buy('a', '2026-09-01', 'Coles', 310)]);
    expect(h.points).toEqual([
      { date: '2026-09-01', shop: 'Coles', unit: 310, expenseId: 'a' },
      { date: '2026-10-12', shop: 'Aldi', unit: 360, expenseId: 'b' },
    ]);
    expect(h.latest).toEqual(h.points[1]);
  });

  it('orders purchases on the same day by expense id, so the result is stable', () => {
    const h = history('Milk 2L', [buy('b', '2026-10-12', 'Aldi', 360), buy('a', '2026-10-12', 'Coles', 310)]);
    expect(h.points.map((p) => p.expenseId)).toEqual(['a', 'b']);
  });

  it('prices by the unit, not the line total', () => {
    const h = history('Milk 2L', [buy('a', '2026-10-01', 'Coles', 700, { quantity: 2, unitAmount: 350 })]);
    expect(h.points[0].unit).toBe(350);
  });

  it('leaves out refund items and the items of a refund', () => {
    const h = history('Milk 2L', [
      buy('a', '2026-10-01', 'Coles', 350),
      buy('r1', '2026-10-02', 'Coles', 350, { refund: true }),
      buy('r2', '2026-10-03', 'Coles', 350, {}, { kind: 'refund' }),
    ]);
    expect(h.points.map((p) => p.expenseId)).toEqual(['a']);
  });

  it('leaves out items with no price', () => {
    const h = history('Milk 2L', [buy('a', '2026-10-01', 'Coles', 0), buy('b', '2026-10-02', 'Coles', 350)]);
    expect(h.points.map((p) => p.expenseId)).toEqual(['b']);
  });

  it('copes with an expense that has no items loaded', () => {
    const h = computePriceHistory('Milk 2L', [makeExpense('x')], {});
    expect(h.points).toEqual([]);
  });

  it('shows the name as it was last written', () => {
    const h = history('milk 2l', [
      buy('a', '2026-09-01', 'Coles', 310, { name: 'milk 2l' }),
      buy('b', '2026-10-01', 'Coles', 350, { name: 'Milk 2L' }),
    ]);
    expect(h.name).toBe('Milk 2L');
  });
});

describe('computePriceHistory shops', () => {
  const bought = [
    buy('a', '2026-07-01', 'Coles', 400),
    buy('b', '2026-08-01', 'aldi', 300),
    buy('c', '2026-09-01', 'ALDI ', 330),
    buy('d', '2026-10-01', 'Coles', 361),
    buy('e', '2026-10-05', 'Aldi', 305),
  ];

  it('sums each shop up: how often, lowest, highest, average and latest', () => {
    const aldi = history('Milk 2L', bought).shops.find((s) => s.shop === 'Aldi')!;
    expect(aldi).toMatchObject({ count: 3, min: 300, max: 330, mean: 312 });
    expect(aldi.latest).toMatchObject({ date: '2026-10-05', unit: 305 });
  });

  it("carries each shop's purchases, oldest first, whatever the case or spacing of the shop", () => {
    const aldi = history('Milk 2L', bought).shops.find((s) => s.shop === 'Aldi')!;
    expect(aldi.points.map((p) => p.expenseId)).toEqual(['b', 'c', 'e']);
  });

  it('puts shops that differ only in case and spacing together, under their newest spelling', () => {
    const shops = history('Milk 2L', bought).shops;
    expect(shops.map((s) => s.shop)).toEqual(['Aldi', 'Coles']);
  });

  it('lists the cheapest shop first, by average', () => {
    const shops = history('Milk 2L', bought).shops;
    expect(shops.map((s) => s.mean)).toEqual([312, 381]);
  });

  it('breaks an average tie by shop name', () => {
    const shops = history('Milk 2L', [buy('a', '2026-10-01', 'Woolworths', 300), buy('b', '2026-10-02', 'Coles', 300)]).shops;
    expect(shops.map((s) => s.shop)).toEqual(['Coles', 'Woolworths']);
  });

  it('calls a shop with no name "Unnamed shop"', () => {
    expect(history('Milk 2L', [buy('a', '2026-10-01', '  ', 300)]).shops[0].shop).toBe('Unnamed shop');
  });
});

describe('computePriceHistory changes', () => {
  const bought = [
    buy('a', '2025-10-10', 'Coles', 300),
    buy('b', '2026-04-12', 'Coles', 310),
    buy('c', '2026-09-20', 'Coles', 340),
    buy('d', '2026-10-12', 'Aldi', 360),
  ];

  it('compares the latest price with the last purchase on or before 6 and 12 months earlier', () => {
    const { changes } = history('Milk 2L', bought);
    expect(changes.map((c) => c.months)).toEqual([6, 12]);
    expect(changes[0]).toMatchObject({ from: { expenseId: 'b', unit: 310 }, to: { expenseId: 'd', unit: 360 } });
    expect(changes[0].pct).toBeCloseTo(16.129, 3);
    expect(changes[1]).toMatchObject({ from: { expenseId: 'a', unit: 300 } });
    expect(changes[1].pct).toBeCloseTo(20, 5);
  });

  it('shows a fall as a negative percent', () => {
    const { changes } = history('Milk 2L', [buy('a', '2026-03-01', 'Coles', 400), buy('b', '2026-10-01', 'Coles', 300)]);
    expect(changes[0].pct).toBeCloseTo(-25, 5);
  });

  it('leaves out a change when nothing was bought that long ago', () => {
    const { changes } = history('Milk 2L', bought.slice(1));
    expect(changes.map((c) => c.months)).toEqual([6]);
    expect(history('Milk 2L', bought.slice(2)).changes).toEqual([]);
  });

  it('keeps only the first horizon when both rest on the same purchase, as the second says nothing more', () => {
    const { changes } = history('Milk 2L', [buy('a', '2025-01-01', 'Coles', 300), buy('b', '2026-10-01', 'Coles', 360)]);
    expect(changes.map((c) => c.months)).toEqual([6]);
  });

  it('has none for a single purchase', () => {
    expect(history('Milk 2L', [buy('a', '2026-10-01', 'Coles', 300)]).changes).toEqual([]);
  });

  it('counts the 6 months back from the latest purchase, shortening the day at a month end', () => {
    // 31 August less six months is 28 February.
    const onTheDay = history('Milk 2L', [buy('a', '2026-02-28', 'Coles', 300), buy('b', '2026-08-31', 'Coles', 330)]);
    expect(onTheDay.changes[0].from.expenseId).toBe('a');
    const dayAfter = history('Milk 2L', [buy('a', '2026-03-01', 'Coles', 300), buy('b', '2026-08-31', 'Coles', 330)]);
    expect(dayAfter.changes).toEqual([]);
  });
});

describe('formatLastPrice', () => {
  it('says what it cost, where and when', () => {
    expect(formatLastPrice({ unit: 340, shop: 'Coles', date: '2026-10-12' }, 'AUD')).toBe('A$3.40 at Coles, 12 Oct');
  });

  it('leaves the shop out when the expense had none', () => {
    expect(formatLastPrice({ unit: 1250, shop: '', date: '2026-01-05' }, 'AUD')).toBe('A$12.50, 5 Jan');
  });
});

describe('priceSeries', () => {
  const lines = (purchases: ReturnType<typeof buy>[], max?: number) => priceSeries(history('Milk 2L', purchases), max);

  it('gives each shop a line of its purchases, oldest first, under its newest spelling', () => {
    const { series, hidden } = lines([
      buy('a', '2026-08-01', 'coles', 400),
      buy('b', '2026-09-01', 'Aldi', 300),
      buy('c', '2026-10-01', 'Coles ', 380),
    ]);
    expect(hidden).toBe(0);
    expect(series.map((s) => s.shop)).toEqual(['Coles', 'Aldi']);
    expect(series[0].points.map((p) => p.expenseId)).toEqual(['a', 'c']);
  });

  it('numbers the lines by the order the shops were first used, so a colour stays with its shop', () => {
    const { series } = lines([
      buy('a', '2026-08-01', 'Coles', 400),
      buy('b', '2026-09-01', 'Aldi', 300),
      buy('c', '2026-09-02', 'Aldi', 310),
      buy('d', '2026-10-01', 'Coles', 380),
      buy('e', '2026-10-02', 'Woolworths', 390),
    ]);
    expect(series.map((s) => [s.shop, s.slot])).toEqual([['Coles', 0], ['Aldi', 1], ['Woolworths', 2]]);
  });

  it('breaks a tie in first use by shop name', () => {
    const { series } = lines([buy('a', '2026-08-01', 'Woolworths', 400), buy('b', '2026-08-01', 'Aldi', 300)]);
    expect(series.map((s) => s.shop)).toEqual(['Aldi', 'Woolworths']);
  });

  it('draws only the shops bought at most, up to the limit, and counts the rest as hidden', () => {
    const { series, hidden } = lines([
      buy('a', '2026-08-01', 'Rare', 400),
      buy('b', '2026-08-02', 'Often', 300),
      buy('c', '2026-08-03', 'Often', 310),
      buy('d', '2026-08-04', 'Often', 320),
      buy('e', '2026-08-05', 'Sometimes', 330),
      buy('f', '2026-08-06', 'Sometimes', 340),
    ], 2);
    expect(series.map((s) => s.shop)).toEqual(['Often', 'Sometimes']);
    expect(hidden).toBe(1);
  });

  it('keeps the shop bought most recently when two are bought as often', () => {
    const { series } = lines([
      buy('a', '2026-08-01', 'Older', 400),
      buy('b', '2026-09-01', 'Newer', 300),
    ], 1);
    expect(series.map((s) => s.shop)).toEqual(['Newer']);
  });

  it('allows five lines unless told otherwise', () => {
    const shops = ['A', 'B', 'C', 'D', 'E', 'F'];
    const { series, hidden } = lines(shops.map((shop, i) => buy(`p${i}`, `2026-08-0${i + 1}`, shop, 300 + i)));
    expect(series).toHaveLength(5);
    expect(hidden).toBe(1);
  });

  it('is empty for an item never bought', () => {
    expect(priceSeries(history('Saffron', []))).toEqual({ series: [], hidden: 0 });
  });
});

describe('canLinkPrices', () => {
  it('is true for a name that can sit in an address', () => {
    expect(canLinkPrices(' Milk 2L ')).toBe(true);
    expect(canLinkPrices('..a')).toBe(true);
    expect(canLinkPrices('7')).toBe(true);
  });

  it('is false for a name with nothing in it, or only dots, which an address would read as a folder', () => {
    expect(canLinkPrices('')).toBe(false);
    expect(canLinkPrices('   ')).toBe(false);
    expect(canLinkPrices('.')).toBe(false);
    expect(canLinkPrices('..')).toBe(false);
    expect(canLinkPrices(' . ')).toBe(false);
  });
});
