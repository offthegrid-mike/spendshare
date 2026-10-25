import { describe, it, expect } from 'vitest';
import { spendTileFigures } from './homeSpend';
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
