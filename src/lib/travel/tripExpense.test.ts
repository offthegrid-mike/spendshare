import { describe, it, expect } from 'vitest';
import {
  parseRate, toHome, chargedRate, buildTripExpense, expenseHomeTotal, isEstimated, tripDayGroups, lastRates, expenseDay,
  type TripExpenseDraft,
} from './tripExpense';
import { makeExpense } from '../../test/fixtures';
import type { ExpenseDoc } from '../../types/models';

describe('parseRate', () => {
  it('reads a plain or decimal-comma rate', () => {
    expect(parseRate('99')).toBe(99);
    expect(parseRate('98.5')).toBe(98.5);
    expect(parseRate('98,5')).toBe(98.5);
    expect(parseRate('0,615')).toBe(0.615);
    expect(parseRate('0.0101')).toBe(0.0101);
  });

  it('reads a comma before three digits as thousands, for currencies with big numbers', () => {
    expect(parseRate('16,000')).toBe(16000);
    expect(parseRate('16 000')).toBe(16000);
  });

  it('reads European and English grouping with a decimal part', () => {
    expect(parseRate('10.450,5')).toBe(10450.5);
    expect(parseRate('10,450.5')).toBe(10450.5);
  });

  it('is NaN for anything else', () => {
    expect(parseRate('')).toBeNaN();
    expect(parseRate('abc')).toBeNaN();
  });
});

describe('toHome', () => {
  it('converts at "1 home = rate foreign" into home minor units (example C estimate)', () => {
    // ¥15,000 at 1 A$ = ¥99 → A$151.52
    expect(toHome(15000, 'JPY', 'AUD', 99)).toBe(15152);
  });

  it('handles currencies with different decimals both ways', () => {
    expect(toHome(1250, 'EUR', 'AUD', 0.625)).toBe(2000); // €12.50 at 1 A$ = €0.625 → A$20.00
    expect(toHome(2000, 'AUD', 'JPY', 1 / 99)).toBe(1980); // A$20 at 1 ¥ = A$1/99 → ¥1,980
  });

  it('leaves an amount in the home currency as it is', () => {
    expect(toHome(1234, 'AUD', 'AUD', 1)).toBe(1234);
  });
});

describe('chargedRate', () => {
  it('works out the rate from what the card was actually charged (example C)', () => {
    // ¥15,000 charged as A$155.10
    expect(chargedRate(15000, 'JPY', 15510, 'AUD')).toBeCloseTo(96.7118, 4);
  });
});

const draft = (over: Partial<TripExpenseDraft> = {}): TripExpenseDraft => ({
  date: '2027-05-12',
  shopName: ' Ichiran ',
  payerUid: 'alex',
  currency: 'JPY',
  rate: '99',
  items: [
    { name: ' Ramen ', categoryId: 'food', amount: '4,500', shared: true, sharedWith: ['alex', 'ben', 'chris'] },
    { name: 'Souvenir', categoryId: 'shop', amount: '1500', shared: false, sharedWith: ['alex', 'ben', 'chris'] },
  ],
  ...over,
});

describe('buildTripExpense', () => {
  it('lets items go without a category when the trip has none to choose from', () => {
    const item = { ...draft().items[0], categoryId: '' };
    expect(buildTripExpense(draft({ items: [item] }), 'AUD', { categoryRequired: false }).ok).toBe(true);
  });

  it('builds the expense in its own currency, with explicit sharers only on shared items', () => {
    const result = buildTripExpense(draft(), 'AUD');
    expect(result).toEqual({
      ok: true,
      value: {
        date: '2027-05-12',
        shopName: 'Ichiran',
        payerUid: 'alex',
        currency: 'JPY',
        rate: 99,
        total: 6000,
        items: [
          { name: 'Ramen', categoryId: 'food', amount: 4500, shared: true, sharedWith: ['alex', 'ben', 'chris'] },
          { name: 'Souvenir', categoryId: 'shop', amount: 1500, shared: false },
        ],
      },
    });
  });

  it('needs no rate in the home currency, and uses 1', () => {
    const result = buildTripExpense(draft({ currency: 'AUD', rate: '', items: [
      { name: 'Taxi', categoryId: 't', amount: '12.50', shared: true, sharedWith: ['ben', 'alex', 'ben'] },
    ] }), 'AUD');
    expect(result.ok && result.value.rate).toBe(1);
    expect(result.ok && result.value.items[0]).toEqual({ name: 'Taxi', categoryId: 't', amount: 1250, shared: true, sharedWith: ['ben', 'alex'] });
  });

  it('skips blank rows', () => {
    const result = buildTripExpense(draft({ items: [...draft().items, { name: ' ', categoryId: 'food', amount: '', shared: true, sharedWith: [] }] }), 'AUD');
    expect(result.ok && result.value.items).toHaveLength(2);
  });

  it('explains what is missing', () => {
    expect(buildTripExpense(draft({ date: '' }), 'AUD')).toEqual({ ok: false, error: 'Choose the date.' });
    expect(buildTripExpense(draft({ payerUid: '' }), 'AUD')).toEqual({ ok: false, error: 'Choose who paid.' });
    expect(buildTripExpense(draft({ rate: '' }), 'AUD')).toEqual({ ok: false, error: 'Enter the exchange rate.' });
    expect(buildTripExpense(draft({ rate: '0' }), 'AUD')).toEqual({ ok: false, error: 'Enter the exchange rate.' });
    expect(buildTripExpense(draft({ items: [] }), 'AUD')).toEqual({ ok: false, error: 'Add at least one item.' });
    const item = draft().items[0];
    expect(buildTripExpense(draft({ items: [{ ...item, name: '' }] }), 'AUD')).toEqual({ ok: false, error: 'Item 1: enter a name.' });
    expect(buildTripExpense(draft({ items: [{ ...item, amount: 'x' }] }), 'AUD')).toEqual({ ok: false, error: 'Item 1: enter an amount.' });
    expect(buildTripExpense(draft({ items: [{ ...item, amount: '0' }] }), 'AUD')).toEqual({ ok: false, error: 'Item 1: enter an amount.' });
    expect(buildTripExpense(draft({ items: [{ ...item, categoryId: '' }] }), 'AUD')).toEqual({ ok: false, error: 'Item 1: choose a category.' });
    expect(buildTripExpense(draft({ items: [{ ...item, sharedWith: [] }] }), 'AUD')).toEqual({ ok: false, error: 'Item 1: choose who shares it.' });
  });
});

function tripExpense(id: string, over: Partial<ExpenseDoc> & { day?: string; created?: number } = {}): ExpenseDoc {
  const { created, ...rest } = over;
  return makeExpense(id, {
    currency: 'JPY', total: 15000,
    paidWith: { kind: 'card', rate: 99, rateStatus: 'estimated' },
    createdAt: (created === undefined ? null : { toMillis: () => created }) as unknown as ExpenseDoc['createdAt'],
    ...rest,
  });
}

describe('expenseHomeTotal and isEstimated', () => {
  it('converts an estimated card payment at its rate', () => {
    const e = tripExpense('e1');
    expect(expenseHomeTotal(e, 'AUD')).toBe(15152);
    expect(isEstimated(e, 'AUD')).toBe(true);
  });

  it('uses the amount actually charged once it is entered', () => {
    const e = tripExpense('e1', { paidWith: { kind: 'card', rate: 96.7118, rateStatus: 'actual', homeTotal: 15510 } });
    expect(expenseHomeTotal(e, 'AUD')).toBe(15510);
    expect(isEstimated(e, 'AUD')).toBe(false);
  });

  it('takes a home-currency expense as it is, never estimated', () => {
    const e = tripExpense('e1', { currency: 'AUD', total: 2500, paidWith: { kind: 'card', rate: 1, rateStatus: 'estimated' } });
    expect(expenseHomeTotal(e, 'AUD')).toBe(2500);
    expect(isEstimated(e, 'AUD')).toBe(false);
    expect(expenseHomeTotal(makeExpense('plain', { total: 900 }), 'AUD')).toBe(900);
  });

  it('cannot value a wallet payment yet', () => {
    expect(expenseHomeTotal(tripExpense('e1', { paidWith: { kind: 'wallet', walletId: 'w1' } }), 'AUD')).toBeNull();
  });
});

describe('expenseDay', () => {
  it('uses the day as chosen when the expense stores it, whatever the viewer’s time zone', () => {
    // The timestamp says 13 May here, but the payer chose 12 May.
    expect(expenseDay(makeExpense('e', { day: '2027-05-13', tripDay: '2027-05-12' } as never))).toBe('2027-05-12');
  });

  it('falls back to the timestamp’s local day', () => {
    expect(expenseDay(makeExpense('e', { day: '2027-05-13' }))).toBe('2027-05-13');
  });
});

describe('tripDayGroups', () => {
  const trip = { startDate: '2027-05-10', endDate: '2027-05-20' };

  it('groups expenses by day, newest day first, labelled with the day of the trip', () => {
    const groups = tripDayGroups([
      tripExpense('a', { day: '2027-05-10' }),
      tripExpense('b', { day: '2027-05-12' }),
      tripExpense('c', { day: '2027-05-12' }),
    ], trip);
    expect(groups.map((g) => [g.date, g.label, g.expenses.map((e) => e.id)])).toEqual([
      ['2027-05-12', 'Day 3 · Wed 12 May', ['b', 'c']],
      ['2027-05-10', 'Day 1 · Mon 10 May', ['a']],
    ]);
  });

  it('lists a day’s expenses newest first, with one still saving at the top', () => {
    const groups = tripDayGroups([
      tripExpense('old', { day: '2027-05-12', created: 1 }),
      tripExpense('saving', { day: '2027-05-12' }),
      tripExpense('new', { day: '2027-05-12', created: 2 }),
    ], trip);
    expect(groups[0].expenses.map((e) => e.id)).toEqual(['saving', 'new', 'old']);
  });

  it('labels days outside the trip as before or after it', () => {
    const groups = tripDayGroups([
      tripExpense('pre', { day: '2027-03-01' }),
      tripExpense('post', { day: '2027-05-22' }),
    ], trip);
    expect(groups.map((g) => g.label)).toEqual(['After the trip · Sat 22 May', 'Before the trip · Mon 1 Mar']);
  });
});

describe('lastRates', () => {
  it('remembers the latest currency used and the latest rate for each currency', () => {
    const result = lastRates([
      tripExpense('old', { created: 1, paidWith: { kind: 'card', rate: 97, rateStatus: 'estimated' } }),
      tripExpense('krw', { created: 2, currency: 'KRW', paidWith: { kind: 'card', rate: 900, rateStatus: 'estimated' } }),
      tripExpense('new', { created: 3, paidWith: { kind: 'card', rate: 99, rateStatus: 'actual', homeTotal: 1 } }),
    ], 'AUD');
    expect(result).toEqual({ currency: 'JPY', rates: { JPY: 99, KRW: 900 } });
  });

  it('treats an expense still saving as the newest', () => {
    const result = lastRates([
      tripExpense('saved', { created: 5 }),
      tripExpense('saving', { currency: 'KRW', paidWith: { kind: 'card', rate: 900, rateStatus: 'estimated' } }),
    ], 'AUD');
    expect(result.currency).toBe('KRW');
  });

  it('starts in the home currency with no rates', () => {
    expect(lastRates([], 'AUD')).toEqual({ currency: 'AUD', rates: {} });
  });
});
