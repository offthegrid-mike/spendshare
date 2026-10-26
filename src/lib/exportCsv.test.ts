import { describe, it, expect } from 'vitest';
import { buildExpensesCsv, csvFileName, periodMonths } from './exportCsv';
import { computeYearSummary } from './yearSummary';
import { makeExpense, makeGroup, makeItem } from '../test/fixtures';
import type { ExpenseDoc, ItemDoc } from '../types/models';

const group = makeGroup('g1', 'Hartley House');

const HEADER = 'date,shop,paid_by,item,category,quantity,unit_price,amount,shared,remark,tags,kind,expense_id,gift_card,card_discount';

/** The CSV as rows of cells; the fixtures never put a comma inside a cell unless a test quotes one. */
function rows(csv: string): string[][] {
  return csv.trimEnd().split('\n').map((line) => line.split(','));
}

function build(expenses: ExpenseDoc[], items: Record<string, ItemDoc[]>) {
  return buildExpensesCsv(group, expenses, items);
}

describe('buildExpensesCsv', () => {
  it('starts with the header, and has only that for no expenses', () => {
    expect(build([], {})).toBe(`${HEADER}\n`);
  });

  it('writes a row per item with the expense, the item and what it cost', () => {
    const e1 = makeExpense('e1', { day: '2026-10-03', shopName: 'Coles', payerUid: 'priya' });
    const csv = build([e1], {
      e1: [
        makeItem('i1', 'e1', { name: 'Oat milk', category: 'Groceries', amount: 700, quantity: 2, unitAmount: 350, shared: true, remark: 'Barista', tags: ['Holiday', 'Snacks'] }),
        makeItem('i2', 'e1', { name: 'Razors', category: 'Health', amount: 1599, shared: false }),
      ],
    });
    expect(rows(csv)).toEqual([
      HEADER.split(','),
      ['2026-10-03', 'Coles', 'Priya', 'Oat milk', 'Groceries', '2', '3.50', '7.00', 'yes', 'Barista', 'Holiday; Snacks', 'purchase', 'e1', '', ''],
      ['2026-10-03', 'Coles', 'Priya', 'Razors', 'Health', '1', '15.99', '15.99', 'no', '', '', 'purchase', 'e1', '', ''],
    ]);
  });

  it('works the unit price out of the line total when none was stored', () => {
    const e1 = makeExpense('e1');
    const csv = build([e1], { e1: [makeItem('i1', 'e1', { amount: 1000, quantity: 3 })] });
    expect(rows(csv)[1].slice(5, 8)).toEqual(['3', '3.33', '10.00']);
  });

  it('shows a refund as negative amounts, with the kind', () => {
    const r1 = makeExpense('r1', { kind: 'refund', refundOf: 'e1' });
    const csv = build([r1], { r1: [makeItem('i1', 'r1', { amount: 700, quantity: 2, unitAmount: 350, refund: true })] });
    const [, row] = rows(csv);
    expect(row.slice(6, 8)).toEqual(['-3.50', '-7.00']);
    expect(row[11]).toBe('refund');
  });

  it('uses a plain minus sign, which a spreadsheet reads as a number', () => {
    const r1 = makeExpense('r1', { kind: 'refund', refundOf: 'e1' });
    const csv = build([r1], { r1: [makeItem('i1', 'r1', { amount: 1, refund: true })] });
    expect(rows(csv)[1][7]).toBe('-0.01');
    expect(csv).not.toContain('−');
  });

  it("puts the gift card and card discount on an expense's first row only", () => {
    const e1 = makeExpense('e1', { total: 3780, giftCardAmount: 2000, discountPercent: 2 });
    const csv = build([e1], {
      e1: [makeItem('i1', 'e1', { amount: 1000 }), makeItem('i2', 'e1', { amount: 2780 })],
    });
    const [, first, second] = rows(csv);
    expect(first.slice(13)).toEqual(['20.00', '0.36']);
    expect(second.slice(13)).toEqual(['', '']);
  });

  it('takes a refund\'s gift card and card discount off too, on its first row', () => {
    const r1 = makeExpense('r1', { total: 3780, giftCardAmount: 2000, discountPercent: 2, kind: 'refund', refundOf: 'e1' });
    const [, first] = rows(build([r1], { r1: [makeItem('i1', 'r1', { amount: 3780, refund: true })] }));
    expect(first.slice(13)).toEqual(['-20.00', '-0.36']);
  });

  it('quotes cells that hold commas, quotes or line breaks', () => {
    const e1 = makeExpense('e1', { shopName: 'Fish, Chips & Co' });
    const csv = build([e1], { e1: [makeItem('i1', 'e1', { name: 'Soup "special"', remark: 'one\ntwo' })] });
    expect(csv).toContain('"Fish, Chips & Co"');
    expect(csv).toContain('"Soup ""special"""');
    expect(csv).toContain('"one\ntwo"');
  });

  it('keeps non-Latin names as they are', () => {
    const e1 = makeExpense('e1', { shopName: '市場' });
    const csv = build([e1], { e1: [makeItem('i1', 'e1', { name: '冷奴豆腐' }), makeItem('i2', 'e1', { name: 'خبز' })] });
    expect(csv).toContain('市場');
    expect(csv).toContain('冷奴豆腐');
    expect(csv).toContain('خبز');
  });

  it('runs by date, then expense id, then item id, whatever order it was given', () => {
    const a = makeExpense('a', { day: '2026-10-05' });
    const b = makeExpense('b', { day: '2026-10-02' });
    const c = makeExpense('c', { day: '2026-10-02' });
    const csv = build([a, c, b], {
      a: [makeItem('i1', 'a')],
      b: [makeItem('i9', 'b'), makeItem('i3', 'b')],
      c: [makeItem('i2', 'c')],
    });
    expect(rows(csv).slice(1).map((r) => [r[12], r[3]])).toEqual([
      ['b', 'Item i3'], ['b', 'Item i9'], ['c', 'Item i2'], ['a', 'Item i1'],
    ]);
  });

  it('still gives an expense with no items loaded one row, with its total, so it is not dropped', () => {
    const e1 = makeExpense('e1', { total: 4500, shopName: 'Coles' });
    const [, row] = rows(build([e1], {}));
    expect(row).toEqual(['2026-10-03', 'Coles', 'Mike', '', '', '', '', '45.00', '', '', '', 'purchase', 'e1', '', '']);
  });

  it('names a payer who has left the group by whatever is known of them', () => {
    const e1 = makeExpense('e1', { payerUid: 'someone-else' });
    expect(rows(build([e1], { e1: [makeItem('i1', 'e1')] }))[1][2]).toBe('someone-else');
  });

  it('adds up to the same total as the Year summary, refunds taken off', () => {
    const e1 = makeExpense('e1', { day: '2026-03-05' });
    const e2 = makeExpense('e2', { day: '2026-09-12' });
    const r1 = makeExpense('r1', { day: '2026-09-20', kind: 'refund', refundOf: 'e2' });
    const items = {
      e1: [makeItem('i1', 'e1', { amount: 1250, month: '2026-03' }), makeItem('i2', 'e1', { amount: 799, quantity: 3, unitAmount: 266, month: '2026-03' })],
      e2: [makeItem('i3', 'e2', { amount: 5000, month: '2026-09' })],
      r1: [makeItem('i4', 'r1', { amount: 1200, refund: true, month: '2026-09' })],
    };
    const csvTotal = rows(build([e1, e2, r1], items)).slice(1).reduce((sum, r) => sum + Math.round(Number(r[7]) * 100), 0);
    const year = computeYearSummary('2026', group.memberUids, Object.values(items).flat(), []);
    expect(csvTotal).toBe(year.grandTotal);
  });
});

describe('periodMonths', () => {
  it('is one month for a month, and January to December for a year', () => {
    expect(periodMonths({ kind: 'month', month: '2026-10' })).toEqual({ from: '2026-10', to: '2026-10' });
    expect(periodMonths({ kind: 'year', year: '2026' })).toEqual({ from: '2026-01', to: '2026-12' });
  });
});

describe('csvFileName', () => {
  it('names the group and the period', () => {
    expect(csvFileName(group, { kind: 'month', month: '2026-10' })).toBe('spendshare-hartley-house-2026-10.csv');
    expect(csvFileName(group, { kind: 'year', year: '2026' })).toBe('spendshare-hartley-house-2026.csv');
  });

  it('keeps a file name safe, whatever the group is called', () => {
    expect(csvFileName({ ...group, name: "Mike & Priya's / flat #2" }, { kind: 'year', year: '2026' })).toBe('spendshare-mike-priya-s-flat-2-2026.csv');
    expect(csvFileName({ ...group, name: '我的家' }, { kind: 'year', year: '2026' })).toBe('spendshare-group-2026.csv');
  });
});
