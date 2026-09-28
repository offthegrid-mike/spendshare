import { describe, it, expect } from 'vitest';
import { computeYearSummary, foldCategories, yearMonths } from './yearSummary';

const items = [
  { month: '2026-01', amount: 1000, shared: true, payerUid: 'u1', category: 'Groceries' },
  { month: '2026-01', amount: 500, shared: false, payerUid: 'u2', category: 'Dining' },
  { month: '2026-03', amount: 3000, shared: true, payerUid: 'u2', category: 'Groceries' },
  // outside the year — must be ignored
  { month: '2025-12', amount: 9999, shared: true, payerUid: 'u1', category: 'Groceries' },
];
const income = [
  { month: '2026-01', uid: 'u1', amount: 5000 },
  { month: '2026-03', uid: 'u2', amount: 2000 },
  { month: '2027-01', uid: 'u1', amount: 7777 }, // outside the year
];

describe('yearMonths', () => {
  it('returns the 12 YYYY-MM keys in order', () => {
    const m = yearMonths('2026');
    expect(m).toHaveLength(12);
    expect(m[0]).toBe('2026-01');
    expect(m[11]).toBe('2026-12');
  });
});

describe('computeYearSummary', () => {
  it('computes year totals and net, ignoring out-of-year docs', () => {
    const s = computeYearSummary('2026', ['u1', 'u2'], items, income);
    expect(s.grandTotal).toBe(4500);
    expect(s.sharedTotal).toBe(4000);
    expect(s.incomeTotal).toBe(7000);
    expect(s.net).toBe(2500);
  });

  it('net is negative when spending exceeds income', () => {
    const s = computeYearSummary('2026', ['u1'], [items[0]], []);
    expect(s.net).toBe(-1000);
  });

  it('computes per-person paid, equal share and income', () => {
    const s = computeYearSummary('2026', ['u1', 'u2'], items, income);
    expect(s.perPerson.u1).toEqual({ paid: 1000, share: 2000, income: 5000 });
    expect(s.perPerson.u2).toEqual({ paid: 3500, share: 2000, income: 2000 });
  });

  it('includes members with no activity as zero paid / zero income', () => {
    const s = computeYearSummary('2026', ['u1', 'u2', 'u3'], items, income);
    expect(s.perPerson.u3.paid).toBe(0);
    expect(s.perPerson.u3.income).toBe(0);
  });

  it('always returns 12 months with zeros for empty months', () => {
    const s = computeYearSummary('2026', ['u1', 'u2'], items, income);
    expect(s.months).toHaveLength(12);
    expect(s.months[0]).toEqual({ month: '2026-01', label: 'Jan', spending: 1500, income: 5000 });
    expect(s.months[1]).toEqual({ month: '2026-02', label: 'Feb', spending: 0, income: 0 });
    expect(s.months[2]).toEqual({ month: '2026-03', label: 'Mar', spending: 3000, income: 2000 });
  });

  it('averages spending and income over months that have any data', () => {
    // Jan (1500 spend / 5000 income) and Mar (3000 / 2000) are the only active months.
    const s = computeYearSummary('2026', ['u1', 'u2'], items, income);
    expect(s.activeMonths).toBe(2);
    expect(s.avgSpending).toBe(2250);
    expect(s.avgIncome).toBe(3500);
  });

  it('counts a month with only income as active and rounds averages to whole cents', () => {
    const s = computeYearSummary(
      '2026',
      ['u1'],
      [{ month: '2026-01', amount: 1000, shared: true, payerUid: 'u1', category: 'Groceries' }],
      [{ month: '2026-02', uid: 'u1', amount: 1 }, { month: '2026-03', uid: 'u1', amount: 1 }],
    );
    expect(s.activeMonths).toBe(3);
    expect(s.avgSpending).toBe(333);
    expect(s.avgIncome).toBe(1);
  });

  it('groups categories, sorted by amount desc, with pct of grand total', () => {
    const s = computeYearSummary('2026', ['u1', 'u2'], items, income);
    expect(s.categories.map((c) => c.category)).toEqual(['Groceries', 'Dining']);
    expect(s.categories[0].amount).toBe(4000);
    expect(s.categories[0].pct).toBeCloseTo(88.89, 1);
    expect(s.categories[1].pct).toBeCloseTo(11.11, 1);
  });

  it('labels items with an empty category as Uncategorized', () => {
    const s = computeYearSummary('2026', ['u1'], [{ ...items[0], category: '' }], []);
    expect(s.categories[0].category).toBe('Uncategorized');
  });

  it('returns empty categories and zero totals for an empty year', () => {
    const s = computeYearSummary('2026', ['u1'], [], []);
    expect(s.categories).toEqual([]);
    expect(s.activeMonths).toBe(0);
    expect(s.avgSpending).toBe(0);
    expect(s.avgIncome).toBe(0);
    expect(s.grandTotal).toBe(0);
    expect(s.net).toBe(0);
  });
});

describe('foldCategories', () => {
  const cats = Array.from({ length: 12 }, (_, i) => ({
    category: `C${i}`,
    amount: 1200 - i * 100,
    pct: 10 - i * 0.5,
  }));

  it('returns the list unchanged when at or under the limit', () => {
    expect(foldCategories(cats.slice(0, 10), 10)).toEqual(cats.slice(0, 10));
  });

  it('keeps the top (max - 1) and folds the rest into Other', () => {
    const out = foldCategories(cats, 10);
    expect(out).toHaveLength(10);
    expect(out[8].category).toBe('C8');
    const rest = cats.slice(9);
    expect(out[9]).toEqual({
      category: 'Other',
      amount: rest.reduce((s, c) => s + c.amount, 0),
      pct: rest.reduce((s, c) => s + c.pct, 0),
    });
  });
});
