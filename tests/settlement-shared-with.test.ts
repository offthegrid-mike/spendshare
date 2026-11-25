import { describe, it, expect } from 'vitest';
import { computeSummary } from '../src/lib/settlement';

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

describe('computeSummary with sharedWith', () => {
  it('treats a missing sharedWith exactly as before: everyone shares', () => {
    const items = [{ amount: 9000, shared: true, payerUid: 'alex' }];
    const before = computeSummary(['alex', 'ben', 'chris'], items, []);
    const withEmpty = computeSummary(['alex', 'ben', 'chris'], [{ ...items[0], sharedWith: [] }], []);
    expect(before.shareOf).toEqual({ alex: 3000, ben: 3000, chris: 3000 });
    expect(withEmpty).toEqual(before);
  });

  it('splits an item only among the people chosen (example B museum)', () => {
    const s = computeSummary(['alex', 'ben', 'chris'], [
      { amount: 30600, shared: true, payerUid: 'chris', sharedWith: ['alex', 'ben'] },
    ], []);
    expect(s.shareOf).toEqual({ alex: 15300, ben: 15300, chris: 0 });
    expect(s.balance).toEqual({ alex: -15300, ben: -15300, chris: 30600 });
    expect(s.sharedTotal).toBe(30600);
  });

  it('adds up shares from items with different sets of people', () => {
    const s = computeSummary(['alex', 'ben', 'chris'], [
      { amount: 51000, shared: true, payerUid: 'alex' },                                 // all three: 17,000 each
      { amount: 30600, shared: true, payerUid: 'alex', sharedWith: ['alex', 'ben'] },    // 15,300 each
    ], []);
    expect(s.shareOf).toEqual({ alex: 32300, ben: 32300, chris: 17000 });
    expect(sum(s.balance)).toBe(0);
    expect(s.transactions).toEqual(expect.arrayContaining([
      { fromUid: 'ben', toUid: 'alex', amount: 32300 },
      { fromUid: 'chris', toUid: 'alex', amount: 17000 },
    ]));
  });

  it('sums each set before splitting, so rounding costs at most one minor unit per set', () => {
    // Three 1-cent items shared by ben and chris: 3 cents split once, not 1 cent three times.
    const items = [1, 1, 1].map((amount) => ({ amount, shared: true, payerUid: 'alex', sharedWith: ['chris', 'ben'] }));
    const s = computeSummary(['alex', 'ben', 'chris'], items, []);
    expect(s.shareOf).toEqual({ alex: 0, ben: 2, chris: 1 });
    expect(sum(s.shareOf)).toBe(3);
  });

  it('treats the same people in a different order, or listed twice, as one set', () => {
    const s = computeSummary(['alex', 'ben', 'chris'], [
      { amount: 1, shared: true, payerUid: 'alex', sharedWith: ['ben', 'chris'] },
      { amount: 1, shared: true, payerUid: 'alex', sharedWith: ['chris', 'ben', 'ben'] },
    ], []);
    expect(s.shareOf).toEqual({ alex: 0, ben: 1, chris: 1 });
  });

  it('treats sharedWith listing every member the same as no sharedWith', () => {
    const s = computeSummary(['alex', 'ben', 'chris'], [
      { amount: 1, shared: true, payerUid: 'alex' },
      { amount: 1, shared: true, payerUid: 'alex', sharedWith: ['chris', 'alex', 'ben'] },
    ], []);
    expect(s.shareOf).toEqual({ alex: 1, ben: 1, chris: 0 });
  });

  it('ignores sharedWith on a personal item', () => {
    const s = computeSummary(['alex', 'ben'], [
      { amount: 5000, shared: false, payerUid: 'alex', sharedWith: ['ben'] },
    ], []);
    expect(s.shareOf).toEqual({ alex: 0, ben: 0 });
    expect(s.balance).toEqual({ alex: 0, ben: 0 });
  });

  it('takes a refund off the shares of the same people', () => {
    const s = computeSummary(['alex', 'ben', 'chris'], [
      { amount: 10000, shared: true, payerUid: 'alex', sharedWith: ['alex', 'ben'] },
      { amount: 4000, shared: true, payerUid: 'alex', sharedWith: ['alex', 'ben'], refund: true },
    ], []);
    expect(s.shareOf).toEqual({ alex: 3000, ben: 3000, chris: 0 });
    expect(s.transactions).toEqual([{ fromUid: 'ben', toUid: 'alex', amount: 3000 }]);
  });

  it('keeps a removed member’s share, so their debt does not vanish', () => {
    const s = computeSummary(['alex', 'ben'], [
      { amount: 9000, shared: true, payerUid: 'alex', sharedWith: ['alex', 'ben', 'gone'] },
    ], []);
    expect(s.shareOf.gone).toBe(3000);
    expect(s.balance.gone).toBe(-3000);
    expect(sum(s.balance)).toBe(0);
    expect(s.transactions).toEqual(expect.arrayContaining([
      { fromUid: 'gone', toUid: 'alex', amount: 3000 },
      { fromUid: 'ben', toUid: 'alex', amount: 3000 },
    ]));
  });
});
