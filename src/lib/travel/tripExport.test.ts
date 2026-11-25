import { describe, it, expect } from 'vitest';
import { expensesCsv, cashCsv, exportFileNames } from './tripExport';
import { tripCash } from './cash';
import { makeExpense, makeItem, makeTrip } from '../../test/fixtures';
import type { TopUpDoc, WalletDoc } from '../../types/models';

const trip = makeTrip('japan', 'Japan & Korea', '2027-05-10', '2027-05-20', ['Alex', 'Ben']);
const card = makeExpense('c', {
  shopName: 'Hotel', payerUid: 'ben', currency: 'JPY', total: 15000, tripDay: '2027-05-12',
  paidWith: { kind: 'card', rate: 99, rateStatus: 'estimated' },
});
const wallet: WalletDoc = { id: 'alex_JPY', kind: 'personal', ownerUid: 'alex', currency: 'JPY', createdByUid: 'alex', createdAt: null as never };
const topUp: TopUpDoc = { id: 't', walletId: 'alex_JPY', byUid: 'alex', date: '2027-05-09', foreignAmount: 100000, homeAmount: 103000, createdAt: null as never };
const dinner = makeExpense('d', {
  shopName: '=HYPERLINK("x")', payerUid: 'alex', currency: 'JPY', total: 60000, tripDay: '2027-05-13',
  paidWith: { kind: 'wallet', walletId: 'alex_JPY' },
});
const items = {
  c: [makeItem('c1', 'c', { name: 'City tax', category: 'Fees', amount: 15000, shared: true, sharedWith: ['alex', 'ben'] })],
  d: [
    makeItem('d1', 'd', { name: 'Dinner, set menu', category: 'Food', amount: 40000, shared: true, sharedWith: ['alex', 'ben'] }),
    makeItem('d2', 'd', { name: 'Sake', category: 'Food', amount: 20000, shared: false }),
  ],
};
const cash = tripCash([wallet], [topUp], [card, dinner]);

describe('expensesCsv', () => {
  it('has a row per item with the amount paid, its home value, and who paid and shared it', () => {
    const lines = expensesCsv(trip, [dinner, card], items, cash).trim().split('\n');
    expect(lines[0]).toBe('date,where,item,category,currency,amount,paid_with,rate,home_currency,home_amount,estimated,paid_by,shared_with');
    expect(lines.slice(1)).toEqual([
      '2027-05-12,Hotel,City tax,Fees,JPY,15000,card,99,AUD,151.52,yes,Ben,Alex; Ben',
      `2027-05-13,"'=HYPERLINK(""x"")","Dinner, set menu",Food,JPY,40000,cash (Alex),97.09,AUD,412.00,no,Alex,Alex; Ben`,
      `2027-05-13,"'=HYPERLINK(""x"")",Sake,Food,JPY,20000,cash (Alex),97.09,AUD,206.00,no,Alex,personal`,
    ]);
  });

  it('keeps member names and tab-led text from being read as formulas', () => {
    const sneaky = { ...trip, members: { ...trip.members, alex: { ...trip.members.alex, displayName: '=HYPERLINK("e")' } } };
    const tabbed = { ...card, shopName: '\t=1+1' };
    const csv = expensesCsv(sneaky, [dinner, tabbed], items, cash);
    expect(csv).not.toMatch(/(^|,)"?=HYPERLINK\(""e""\)/m);
    expect(csv).toContain(`"'=HYPERLINK(""e"")"`);
    expect(csv).toContain(`'\t=1+1`);
    const cashLines = cashCsv(sneaky, cash, [dinner]);
    expect(cashLines).not.toMatch(/(^|,)"?=HYPERLINK/m);
  });
});

describe('cashCsv', () => {
  it('has a row for every top-up and cash payment, oldest first', () => {
    const lines = cashCsv(trip, cash, [dinner]).trim().split('\n');
    expect(lines).toEqual([
      'wallet,date,what,person,currency,cash,home_currency,cost',
      'Alex JPY,2027-05-09,bought,Alex,JPY,100000,AUD,1030.00',
      `Alex JPY,2027-05-13,"spent: =HYPERLINK(""x"")",Alex,JPY,-60000,AUD,-618.00`,
    ]);
  });
});

describe('exportFileNames', () => {
  it('names the files after the trip', () => {
    expect(exportFileNames(trip)).toEqual({ expenses: 'japan-korea-expenses.csv', cash: 'japan-korea-cash.csv' });
  });
});
