import { describe, it, expect } from 'vitest';
import { valueTrip, tripSummary, spreadInProportion, tripBreakdown, tripMemberName, tripBalanceCopy, viewerTripFigures } from './valueTrip';
import { makeExpense, makeItem, makeTrip } from '../../test/fixtures';
import type { ExpenseDoc, ItemDoc } from '../../types/models';

const trip = makeTrip('japan', 'Japan', '2027-05-10', '2027-05-20', ['Alex', 'Ben', 'Chris']);

function card(id: string, over: Partial<ExpenseDoc> = {}): ExpenseDoc {
  return makeExpense(id, { currency: 'JPY', paidWith: { kind: 'card', rate: 99, rateStatus: 'estimated' }, ...over });
}
const item = (id: string, expenseId: string, over: Partial<ItemDoc> = {}) => makeItem(id, expenseId, over);

describe('spreadInProportion', () => {
  it('splits a total across amounts in proportion, adding back exactly to the total', () => {
    expect(spreadInProportion(15152, [10000, 5000])).toEqual([10101, 5051]);
    expect(spreadInProportion(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(spreadInProportion(0, [5, 5])).toEqual([0, 0]);
  });

  it('gives nothing to anything when there is nothing to spread over', () => {
    expect(spreadInProportion(500, [])).toEqual([]);
    expect(spreadInProportion(500, [0, 0])).toEqual([0, 0]);
  });
});

describe('valueTrip — worked example C', () => {
  // Ben pays ¥15,000 hotel tax by card, shared by Ben and Chris.
  const expense = card('tax', { payerUid: 'ben', total: 15000 });
  const items = { tax: [item('i1', 'tax', { amount: 15000, payerUid: 'ben', shared: true, sharedWith: ['ben', 'chris'] })] };

  it('values the estimate at 1 A$ = ¥99: Chris owes Ben half of A$151.52', () => {
    const v = valueTrip(trip, [expense], items);
    expect(v.items).toEqual([expect.objectContaining({ amount: 15152, payerUid: 'ben', shared: true, sharedWith: ['ben', 'chris'] })]);
    expect(v.estimated.map((e) => e.id)).toEqual(['tax']);
    expect(tripSummary(v, []).transactions).toEqual([{ fromUid: 'chris', toUid: 'ben', amount: 7576 }]);
  });

  it('uses what the card was charged once entered: Chris owes Ben A$77.55', () => {
    const charged = { ...expense, paidWith: { kind: 'card' as const, rate: 96.71, rateStatus: 'actual' as const, homeTotal: 15510 } };
    const v = valueTrip(trip, [charged], items);
    expect(v.estimated).toEqual([]);
    expect(tripSummary(v, []).transactions).toEqual([{ fromUid: 'chris', toUid: 'ben', amount: 7755 }]);
  });
});

describe('valueTrip', () => {
  it('spreads a card charge over the items in proportion to their amounts', () => {
    const e = card('e', { payerUid: 'alex', total: 15000, paidWith: { kind: 'card', rate: 97, rateStatus: 'actual', homeTotal: 15152 } });
    const v = valueTrip(trip, [e], { e: [item('a', 'e', { amount: 10000 }), item('b', 'e', { amount: 5000 })] });
    expect(v.items.map((i) => i.amount)).toEqual([10101, 5051]);
  });

  it('takes home-currency expenses as they are, and keeps categories for the breakdown', () => {
    const e = makeExpense('taxi', { currency: 'AUD', total: 2500, paidWith: { kind: 'card', rate: 1, rateStatus: 'actual' } });
    const v = valueTrip(trip, [e], { taxi: [item('t', 'taxi', { amount: 2500, categoryId: 'tr', category: 'Transport' })] });
    expect(v.items).toEqual([expect.objectContaining({ amount: 2500, categoryId: 'tr', category: 'Transport', expenseId: 'taxi' })]);
  });

  it('leaves out wallet payments, which can’t be valued until wallets exist, and lists them', () => {
    const e = card('cash', { paidWith: { kind: 'wallet', walletId: 'w1' } });
    const v = valueTrip(trip, [e], { cash: [item('c', 'cash')] });
    expect(v.items).toEqual([]);
    expect(v.unvalued.map((x) => x.id)).toEqual(['cash']);
  });

  it('counts a former member who paid, so they are paid back and balances add up', () => {
    const e = makeExpense('e', { payerUid: 'gone', currency: 'AUD', total: 9000, paidWith: { kind: 'card', rate: 1, rateStatus: 'actual' } });
    const v = valueTrip(trip, [e], { e: [item('i', 'e', { amount: 9000, payerUid: 'gone', shared: true, sharedWith: ['alex', 'ben', 'gone'] })] });
    expect(v.parties).toEqual(['alex', 'ben', 'chris', 'gone']);
    const s = tripSummary(v, []);
    expect(s.balance).toEqual({ alex: -3000, ben: -3000, chris: 0, gone: 6000 });
    expect(s.transactions).toEqual(expect.arrayContaining([
      { fromUid: 'alex', toUid: 'gone', amount: 3000 },
      { fromUid: 'ben', toUid: 'gone', amount: 3000 },
    ]));
  });

  it('applies settle-up payments already made', () => {
    const expense = card('tax', { payerUid: 'ben', total: 15000 });
    const items = { tax: [item('i1', 'tax', { amount: 15000, payerUid: 'ben', shared: true, sharedWith: ['ben', 'chris'] })] };
    const s = tripSummary(valueTrip(trip, [expense], items), [{ fromUid: 'chris', toUid: 'ben', amount: 7576, paid: true }]);
    expect(s.transactions).toEqual([]);
  });

  it('splits a shared item with no list of sharers among current members only, not former ones', () => {
    const e = makeExpense('e', { payerUid: 'gone', currency: 'AUD', total: 900, paidWith: { kind: 'card', rate: 1, rateStatus: 'actual' } });
    const v = valueTrip(trip, [e], { e: [item('i', 'e', { amount: 900, payerUid: 'gone', shared: true })] });
    expect(v.items[0].sharedWith).toEqual(['alex', 'ben', 'chris']);
    expect(tripSummary(v, []).shareOf).toEqual({ alex: 300, ben: 300, chris: 300, gone: 0 });
  });

  it('skips an expense whose items have not loaded', () => {
    expect(valueTrip(trip, [card('e')], {}).items).toEqual([]);
  });
});

describe('tripBreakdown', () => {
  it('totals spending by category and by person in home currency, and by the currency paid in', () => {
    const ramen = card('r', { payerUid: 'alex', total: 9900 }); // ¥9,900 at 99 = A$100
    const taxi = makeExpense('t', { payerUid: 'ben', currency: 'AUD', total: 2500, paidWith: { kind: 'card', rate: 1, rateStatus: 'actual' } });
    const v = valueTrip(trip, [ramen, taxi], {
      r: [item('r1', 'r', { amount: 9900, payerUid: 'alex', category: 'Food', categoryId: 'f' })],
      t: [item('t1', 't', { amount: 2500, payerUid: 'ben', category: 'Transport', categoryId: 'tr' })],
    });
    expect(tripBreakdown(v, [ramen, taxi], 'AUD')).toEqual({
      spent: 12500,
      byCategory: [{ name: 'Food', amount: 10000 }, { name: 'Transport', amount: 2500 }],
      byCurrency: [{ currency: 'JPY', amount: 9900 }, { currency: 'AUD', amount: 2500 }],
    });
  });
});

describe('tripBreakdown with current category names', () => {
  it('groups by category id, under its current name', () => {
    const a = makeExpense('a', { currency: 'AUD', total: 100, paidWith: { kind: 'card', rate: 1, rateStatus: 'actual' } });
    const b = makeExpense('b', { currency: 'AUD', total: 50, paidWith: { kind: 'card', rate: 1, rateStatus: 'actual' } });
    const v = valueTrip(trip, [a, b], {
      a: [item('a1', 'a', { amount: 100, categoryId: 'f', category: 'Food' })],
      b: [item('b1', 'b', { amount: 50, categoryId: 'f', category: 'Food & drink' })],
    });
    expect(tripBreakdown(v, [a, b], 'AUD', { f: 'Food & drink' }).byCategory).toEqual([{ name: 'Food & drink', amount: 150 }]);
  });
});

describe('viewerTripFigures', () => {
  it('counts a total with cash payments in it as approximate, as the expense list does', () => {
    const e = makeExpense('d', { payerUid: 'alex', currency: 'JPY', total: 60000, paidWith: { kind: 'wallet', walletId: 'alex_JPY' } });
    const figures = viewerTripFigures(trip, 'alex', [e], { d: [item('i', 'd', { amount: 60000, payerUid: 'alex', shared: false })] }, [], { d: 61800 });
    expect(figures).toEqual(expect.objectContaining({ spent: 61800, estimated: true }));
  });
});

describe('names and balance copy', () => {
  it('names the viewer, a member, and someone who has left', () => {
    expect(tripMemberName(trip, 'alex', 'alex')).toBe('You');
    expect(tripMemberName(trip, 'ben', 'alex')).toBe('Ben');
    expect(tripMemberName(trip, 'gone', 'alex')).toBe('A former member');
  });

  it('says who gets back or owes what, in the home currency’s own decimals', () => {
    expect(tripBalanceCopy(7576, false, 'AUD')).toEqual({ verb: 'Gets back', amount: 'A$75.76', tone: 'owed' });
    expect(tripBalanceCopy(-7576, true, 'AUD')).toEqual({ verb: 'You owe', amount: 'A$75.76', tone: 'owe' });
    expect(tripBalanceCopy(-500, false, 'JPY')).toEqual({ verb: 'Owes', amount: '¥500', tone: 'owe' });
    expect(tripBalanceCopy(0, true, 'AUD')).toEqual({ verb: 'Settled', amount: '', tone: 'settled' });
  });
});
