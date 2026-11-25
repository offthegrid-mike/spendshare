import { describe, it, expect } from 'vitest';
import { tripCash, walletIdFor, kittyIdFor, readableWalletRate, cashLeftFor } from './cash';
import { valueTrip, tripSummary } from './valueTrip';
import { expenseHomeTotal } from './tripExpense';
import { makeExpense, makeItem, makeTrip } from '../../test/fixtures';
import type { ExpenseDoc, TopUpDoc, WalletDoc } from '../../types/models';

const trip = makeTrip('japan', 'Japan', '2027-05-10', '2027-05-20', ['Alex', 'Ben', 'Chris']);
const wallet = (ownerUid: string, currency = 'JPY'): WalletDoc => ({
  id: walletIdFor(ownerUid, currency), kind: 'personal', ownerUid, currency,
  createdByUid: ownerUid, createdAt: null as never,
});
const topUp = (id: string, walletId: string, foreignAmount: number, homeAmount: number, date = '2027-05-09'): TopUpDoc => ({
  id, walletId, byUid: 'alex', date, foreignAmount, homeAmount, createdAt: null as never,
});
function cashPayment(id: string, walletId: string, total: number, over: Partial<ExpenseDoc> & { created?: number } = {}): ExpenseDoc {
  const { created, ...rest } = over;
  return makeExpense(id, {
    currency: 'JPY', total, payerUid: 'alex', paidWith: { kind: 'wallet', walletId }, tripDay: '2027-05-12',
    createdAt: (created === undefined ? null : { toMillis: () => created }) as never,
    ...rest,
  });
}

// Worked example A: Alex buys ¥50,000 for A$500, then ¥50,000 for A$530 (average 0.0103).
const alexYen = wallet('alex');
const exampleA = [topUp('t1', alexYen.id, 50000, 50000), topUp('t2', alexYen.id, 50000, 53000)];

describe('walletIdFor', () => {
  it('gives one wallet per person per currency', () => {
    expect(walletIdFor('alex', 'JPY')).toBe('alex_JPY');
  });
});

describe('tripCash — worked example A', () => {
  const dinner = cashPayment('dinner', alexYen.id, 60000);
  const cash = tripCash([alexYen], exampleA, [dinner]);

  it('values the ¥60,000 dinner at the wallet’s average rate: A$618', () => {
    expect(cash.values).toEqual({ dinner: 61800 });
    expect(expenseHomeTotal(dinner, 'AUD', cash.values)).toBe(61800);
  });

  it('shows ¥40,000 left, worth A$412, so spent plus left is what was paid', () => {
    const [state] = cash.wallets;
    expect(state.paidIn).toEqual({ foreign: 100000, home: 103000 });
    expect(state.spent).toBe(60000);
    expect(state.left).toEqual({ foreign: 40000, home: 41200 });
  });

  it('settles as Ben and Chris each paying Alex A$206', () => {
    const items = { dinner: [makeItem('i', 'dinner', { amount: 60000, payerUid: 'alex', shared: true, sharedWith: ['alex', 'ben', 'chris'] })] };
    const s = tripSummary(valueTrip(trip, [dinner], items, cash.values), []);
    expect(s.transactions).toEqual(expect.arrayContaining([
      { fromUid: 'ben', toUid: 'alex', amount: 20600 },
      { fromUid: 'chris', toUid: 'alex', amount: 20600 },
    ]));
  });

  it('reads the average rate as 1 AUD = 97.09 JPY', () => {
    expect(readableWalletRate(cash.wallets[0].rate!, 'JPY', 'AUD')).toBe('97.09');
  });
});

describe('tripCash', () => {
  it('values a wallet’s payments in day order, then by when they were added, so rounding never drifts', () => {
    const w = wallet('alex');
    const tiny = [topUp('t', w.id, 3, 1)]; // ¥3 for 1 cent
    const cash = tripCash([w], tiny, [
      cashPayment('late', w.id, 1, { tripDay: '2027-05-13', created: 1 }),
      cashPayment('second', w.id, 1, { tripDay: '2027-05-12', created: 2 }),
      cashPayment('first', w.id, 1, { tripDay: '2027-05-12', created: 1 }),
    ]);
    expect(cash.values).toEqual({ first: 0, second: 1, late: 0 });
    expect(cash.wallets[0].left).toEqual({ foreign: 0, home: 0 });
  });

  it('keeps each wallet’s payments to that wallet', () => {
    const a = wallet('alex');
    const b = wallet('ben');
    const cash = tripCash([a, b], [topUp('ta', a.id, 10000, 10000), topUp('tb', b.id, 10000, 11000)], [
      cashPayment('x', a.id, 1000), cashPayment('y', b.id, 1000, { payerUid: 'ben' }),
    ]);
    expect(cash.values).toEqual({ x: 1000, y: 1100 });
  });

  it('cannot value payments from a wallet with no cash added, or one that no longer exists', () => {
    const w = wallet('alex');
    const cash = tripCash([w], [], [cashPayment('x', w.id, 1000), cashPayment('y', 'ghost_JPY', 500)]);
    expect(cash.values).toEqual({ x: null, y: null });
    expect(cash.wallets[0].left).toEqual({ foreign: -1000, home: null });
    expect(cash.wallets[0].rate).toBeNull();
  });

  it('reports a wallet spent beyond the cash put in, rather than hiding it', () => {
    const w = wallet('alex');
    const cash = tripCash([w], [topUp('t', w.id, 1000, 1000)], [cashPayment('x', w.id, 1500)]);
    expect(cash.wallets[0].left.foreign).toBe(-500);
  });

  it('ignores card payments', () => {
    const card = makeExpense('c', { currency: 'JPY', total: 900, paidWith: { kind: 'card', rate: 99, rateStatus: 'estimated' } });
    expect(tripCash([], [], [card]).values).toEqual({});
  });

  it('lists top-ups on the same day in the order they were added', () => {
    const w = wallet('alex');
    const at = (id: string, ms: number | null) => ({ ...topUp(id, w.id, 1, 1), createdAt: (ms === null ? null : { toMillis: () => ms }) as never });
    const cash = tripCash([w], [at('saving', null), at('second', 2), at('first', 1)], []);
    expect(cash.wallets[0].topUps.map((t) => t.id)).toEqual(['first', 'second', 'saving']);
  });

  it('lists top-ups oldest first', () => {
    const w = wallet('alex');
    const cash = tripCash([w], [topUp('b', w.id, 1, 1, '2027-05-11'), topUp('a', w.id, 1, 1, '2027-05-01')], []);
    expect(cash.wallets[0].topUps.map((t) => t.id)).toEqual(['a', 'b']);
  });
});

describe('tripCash — a running average in date order', () => {
  const w = wallet('alex');

  it('values a payment only from the cash bought up to its day, so buying more later doesn’t change it', () => {
    const cash = tripCash([w], [
      topUp('first', w.id, 50000, 50000, '2027-05-10'),
      topUp('later', w.id, 50000, 53000, '2027-05-12'),
    ], [cashPayment('dinner', w.id, 50000, { tripDay: '2027-05-10' })]);
    expect(cash.values).toEqual({ dinner: 50000 });
    expect(cash.wallets[0].left).toEqual({ foreign: 50000, home: 53000 });
  });

  it('gives the average of the cash left, which is what the next payment draws from', () => {
    const cash = tripCash([w], [
      topUp('first', w.id, 50000, 50000, '2027-05-10'),
      topUp('later', w.id, 50000, 53000, '2027-05-12'),
    ], [cashPayment('dinner', w.id, 50000, { tripDay: '2027-05-10' })]);
    expect(cash.wallets[0].leftRate).toEqual({ foreign: 50000, home: 53000 });
    expect(cash.wallets[0].rate).toEqual({ foreign: 100000, home: 103000 });
  });

  it('counts cash bought on the day of a payment as bought before it', () => {
    const cash = tripCash([w], [topUp('same', w.id, 1000, 1000, '2027-05-12')], [cashPayment('x', w.id, 1000, { tripDay: '2027-05-12' })]);
    expect(cash.values).toEqual({ x: 1000 });
  });

  it('values a payment made before any cash was recorded at the wallet’s overall average', () => {
    const cash = tripCash([w], [topUp('t', w.id, 10000, 10300, '2027-05-14')], [cashPayment('x', w.id, 1000, { tripDay: '2027-05-11' })]);
    expect(cash.values).toEqual({ x: 1030 });
    expect(cash.wallets[0].left).toEqual({ foreign: 9000, home: 9270 });
  });

  it('values the part of an overspend beyond the cash left at the overall average, keeping spent plus left exact', () => {
    const cash = tripCash([w], [topUp('t', w.id, 1000, 1000)], [cashPayment('x', w.id, 1500)]);
    expect(cash.values).toEqual({ x: 1500 });
    expect(cash.wallets[0].left).toEqual({ foreign: -500, home: -500 });
  });

  it('leaves a payment in another currency than its wallet unvalued, rather than mis-valuing it', () => {
    const cash = tripCash([w], [topUp('t', w.id, 1000, 1000)], [cashPayment('usd', w.id, 2000, { currency: 'USD' })]);
    expect(cash.values).toEqual({ usd: null });
    expect(cash.wallets[0].left.foreign).toBe(1000);
  });
});

describe('cashLeftFor', () => {
  it('is the wallet’s cash left, adding back what an expense being edited already took', () => {
    const w = wallet('alex');
    const spend = cashPayment('x', w.id, 3000);
    const cash = tripCash([w], [topUp('t', w.id, 10000, 10000)], [spend]);
    expect(cashLeftFor(cash, w.id)).toBe(7000);
    expect(cashLeftFor(cash, w.id, spend)).toBe(10000);
    expect(cashLeftFor(cash, 'nope_JPY')).toBeNull();
  });
});

describe('the kitty — worked example B', () => {
  // Alex puts in A$300 (¥30,000), Ben A$300 (¥30,000), Chris A$420 (¥40,000): ¥100,000 for A$1,020.
  const kitty: WalletDoc = { id: kittyIdFor('JPY'), kind: 'kitty', currency: 'JPY', createdByUid: 'alex', createdAt: null as never };
  const put = (id: string, fromUid: string, foreignAmount: number, homeAmount: number): TopUpDoc => ({
    ...topUp(id, kitty.id, foreignAmount, homeAmount), fromUid,
  });
  const ups = [put('a', 'alex', 30000, 30000), put('b', 'ben', 30000, 30000), put('c', 'chris', 40000, 42000)];
  // The kitty pays ¥50,000 for dinner (all three) and ¥30,000 for the museum (Alex and Ben); Ben carries the cash.
  const dinner = cashPayment('dinner', kitty.id, 50000, { payerUid: 'ben' });
  const museum = cashPayment('museum', kitty.id, 30000, { payerUid: 'ben', created: 5 });
  const items = {
    dinner: [makeItem('d', 'dinner', { amount: 50000, payerUid: 'ben', shared: true, sharedWith: ['alex', 'ben', 'chris'] })],
    museum: [makeItem('m', 'museum', { amount: 30000, payerUid: 'ben', shared: true, sharedWith: ['alex', 'ben'] })],
  };
  const cash = tripCash([kitty], ups, [dinner, museum]);

  it('values the kitty’s spending at its average rate: A$510 and A$306', () => {
    expect(cash.values).toEqual({ dinner: 51000, museum: 30600 });
  });

  it('shares the ¥20,000 left by the cash each put in: ¥6,000, ¥6,000 and ¥8,000', () => {
    const k = cash.wallets[0].kitty!;
    expect(k.contributors).toEqual([
      { uid: 'alex', foreign: 30000, home: 30000, handBack: 6000, handBackHome: 6120, credit: 23880 },
      { uid: 'ben', foreign: 30000, home: 30000, handBack: 6000, handBackHome: 6120, credit: 23880 },
      { uid: 'chris', foreign: 40000, home: 42000, handBack: 8000, handBackHome: 8160, credit: 33840 },
    ]);
  });

  it('settles as Alex and Ben each paying Chris A$84.20, with the kitty itself owing nothing', () => {
    const v = valueTrip(trip, [dinner, museum], items, cash.values, cash.kittyCredits);
    expect(v.people).toEqual(['alex', 'ben', 'chris']);
    const s = tripSummary(v, []);
    expect(s.balance).toEqual({ alex: -8420, ben: -8420, chris: 16840, [kitty.id]: 0 });
    expect(s.transactions).toEqual(expect.arrayContaining([
      { fromUid: 'alex', toUid: 'chris', amount: 8420 },
      { fromUid: 'ben', toUid: 'chris', amount: 8420 },
    ]));
    expect(s.transactions).toHaveLength(2);
  });
});

describe('the kitty', () => {
  const kitty: WalletDoc = { id: kittyIdFor('JPY'), kind: 'kitty', currency: 'JPY', createdByUid: 'alex', createdAt: null as never };
  const put = (id: string, fromUid: string, foreignAmount: number, homeAmount: number): TopUpDoc => ({
    ...topUp(id, kitty.id, foreignAmount, homeAmount), fromUid,
  });

  it('adds up several contributions from the same person', () => {
    const cash = tripCash([kitty], [put('a1', 'alex', 1000, 1000), put('a2', 'alex', 1000, 1100)], []);
    expect(cash.wallets[0].kitty!.contributors).toEqual([
      { uid: 'alex', foreign: 2000, home: 2100, handBack: 2000, handBackHome: 2100, credit: 0 },
    ]);
  });

  it('credits whoever handed over the cash for what the kitty paid beyond what was put in', () => {
    const over = cashPayment('over', kitty.id, 1500, { payerUid: 'ben' });
    const cash = tripCash([kitty], [put('a', 'alex', 1000, 1000)], [over]);
    expect(cash.wallets[0].kitty!.contributors).toEqual([
      { uid: 'alex', foreign: 1000, home: 1000, handBack: 0, handBackHome: 0, credit: 1000 },
    ]);
    expect(cash.kittyCredits).toEqual([
      { fromUid: 'alex', toUid: kitty.id, amount: 1000, paid: true },
      { fromUid: 'ben', toUid: kitty.id, amount: 500, paid: true },
    ]);
    const v = valueTrip(trip, [over], { over: [makeItem('o', 'over', { amount: 1500, payerUid: 'ben', shared: true, sharedWith: ['alex', 'ben', 'chris'] })] }, cash.values, cash.kittyCredits);
    expect(tripSummary(v, []).balance[kitty.id]).toBe(0);
  });

  it('is never anyone’s cash: its payments aren’t credited to who handed them over', () => {
    const e = cashPayment('e', kitty.id, 1000, { payerUid: 'ben' });
    const cash = tripCash([kitty], [put('a', 'alex', 1000, 1000)], [e]);
    const v = valueTrip(trip, [e], { e: [makeItem('i', 'e', { amount: 1000, payerUid: 'ben', shared: true, sharedWith: ['alex'] })] }, cash.values, cash.kittyCredits);
    expect(tripSummary(v, []).balance).toEqual({ alex: 0, ben: 0, chris: 0, [kitty.id]: 0 });
  });
});
