import { describe, it, expect } from 'vitest';
import { budgetTileLine, spendTileFigures } from './homeSpend';
import type { BudgetRow } from './budget';
import { makeGroup } from '../test/fixtures';

const group = makeGroup('g1', 'The Smiths'); // uids 'mike', 'priya'

describe('spendTileFigures', () => {
  it('gives the month, total spent and the viewer-side balance', () => {
    const items = [{ amount: 10000, shared: true, payerUid: 'mike' }];
    expect(spendTileFigures(group, 'mike', items, [], '2026-10')).toEqual({
      monthLabel: 'October',
      spent: 10000,
      empty: false,
      balanceLabel: 'Priya owes you',
      balanceAmount: 5000,
      tone: 'owed',
    });
  });

  it('reads the balance from the other side for the other member', () => {
    const items = [{ amount: 10000, shared: true, payerUid: 'mike' }];
    expect(spendTileFigures(group, 'priya', items, [], '2026-10')).toMatchObject({
      balanceLabel: 'You owe Mike',
      balanceAmount: 5000,
      tone: 'owe',
    });
  });

  it('sums the rounded item amounts, shared or not', () => {
    const items = [
      { amount: 1000.4, shared: true, payerUid: 'mike' },
      { amount: 250.6, shared: false, payerUid: 'priya' },
    ];
    expect(spendTileFigures(group, 'mike', items, [], '2026-10').spent).toBe(1000 + 251);
  });

  it('reads as nothing to settle for a month with no items', () => {
    expect(spendTileFigures(group, 'mike', [], [], '2026-10')).toEqual({
      monthLabel: 'October',
      spent: 0,
      empty: true,
      balanceLabel: 'Nothing to settle',
      balanceAmount: 0,
      tone: 'settled',
    });
  });

  it('reads as settled for the month once the balance is paid off', () => {
    const items = [{ amount: 10000, shared: true, payerUid: 'mike' }];
    const settlements = [
      { id: 's1', month: '2026-10', fromUid: 'priya', toUid: 'mike', amount: 5000, paid: true },
    ];
    expect(spendTileFigures(group, 'mike', items, settlements, '2026-10')).toMatchObject({
      empty: false,
      balanceLabel: 'All settled for October',
      balanceAmount: 0,
      tone: 'settled',
    });
  });
});

describe('spendTileFigures with refunds', () => {
  it('takes refunds off what was spent', () => {
    const items = [
      { amount: 10000, shared: true, payerUid: 'mike' },
      { amount: 2500, shared: true, payerUid: 'mike', refund: true },
    ];
    expect(spendTileFigures(group, 'mike', items, [], '2026-10').spent).toBe(7500);
  });
});

describe('budgetTileLine', () => {
  const row = (over: Partial<BudgetRow> = {}): BudgetRow => ({
    categoryId: 'groceries', name: 'Groceries', spent: 0, limit: 40000, remaining: 40000, pct: 0, status: 'ok', ...over,
  });

  it('has no line without budgets', () => {
    expect(budgetTileLine([], 12, 'AUD')).toBeNull();
  });

  it('says budgets are on track while none is at 80%', () => {
    expect(budgetTileLine([row({ pct: 79, status: 'ok' }), row({ categoryId: 'd', name: 'Dining' })], 12, 'AUD'))
      .toEqual({ label: 'Budgets on track', note: '12 days left', tone: 'ok' });
  });

  it('names the budget most used once it is at 80% or more', () => {
    const rows = [
      row({ pct: 85.4, status: 'warn', spent: 34160, remaining: 5840 }),
      row({ categoryId: 'd', name: 'Dining', pct: 91.2, status: 'warn', spent: 36480, remaining: 3520 }),
    ];
    expect(budgetTileLine(rows, 9, 'AUD')).toEqual({ label: 'Dining 91% used', note: '9 days left', tone: 'warn' });
  });

  it('says how far over a budget that has been passed, ahead of ones that are close', () => {
    const rows = [
      row({ pct: 99, status: 'warn', spent: 39600, remaining: 400 }),
      row({ categoryId: 'd', name: 'Dining', pct: 112, status: 'over', spent: 44800, remaining: -4800 }),
    ];
    expect(budgetTileLine(rows, 9, 'AUD')).toEqual({ label: 'Dining over budget', note: 'A$48.00 over', tone: 'over' });
  });

  it('says a budget spent to the cent is fully used', () => {
    expect(budgetTileLine([row({ pct: 100, status: 'over', spent: 40000, remaining: 0 })], 9, 'AUD'))
      .toEqual({ label: 'Groceries fully used', note: '9 days left', tone: 'over' });
  });

  it('counts down to the last day, in the singular for one', () => {
    expect(budgetTileLine([row()], 1, 'AUD')?.note).toBe('1 day left');
    expect(budgetTileLine([row()], 0, 'AUD')?.note).toBe('Last day');
  });
});
