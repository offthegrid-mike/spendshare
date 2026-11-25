import { describe, it, expect } from 'vitest';
import { walletRate, valueCash, valueSpends, walletBalance } from './wallet';

// Worked example A in docs/TRAVEL_PLAN.md: two exchanges at different rates.
const exampleA = [
  { foreignAmount: 50000, homeAmount: 50000 }, // ¥50,000 for A$500.00 (0.0100)
  { foreignAmount: 50000, homeAmount: 53000 }, // ¥50,000 for A$530.00 (0.0106)
];

describe('walletRate', () => {
  it('sums what was paid and what was received, so the average is exact', () => {
    expect(walletRate(exampleA)).toEqual({ home: 103000, foreign: 100000 });
  });

  it('is null for a wallet with no cash put in yet', () => {
    expect(walletRate([])).toBeNull();
  });
});

describe('valueCash', () => {
  const rate = { home: 103000, foreign: 100000 };

  it('values cash at the wallet’s average rate (example A dinner)', () => {
    expect(valueCash(60000, rate)).toBe(61800); // ¥60,000 → A$618.00
  });

  it('rounds to the nearest minor unit of the home currency', () => {
    // ¥1 at 0.0103 = 1.03 cents → 1; ¥50 = 51.5 cents → 52
    expect(valueCash(1, rate)).toBe(1);
    expect(valueCash(50, rate)).toBe(52);
  });

  it('values a cash refund as exactly minus the same spend', () => {
    expect(valueCash(-50, rate)).toBe(-52);
  });

  it('values nothing as zero', () => {
    expect(valueCash(0, rate)).toBe(0);
  });

  it('never returns minus zero', () => {
    expect(Object.is(valueCash(-1, { home: 1, foreign: 3 }), 0)).toBe(true);
  });
});

describe('valueSpends', () => {
  it('values payments cumulatively, so rounding never drifts from the total', () => {
    // At 1/3 of a cent per unit, three payments of 1 are worth 1 cent together.
    const rate = { home: 1, foreign: 3 };
    expect(valueSpends([1, 1, 1], rate)).toEqual([0, 1, 0]);
    expect(valueSpends([1, 1, 1], rate).reduce((a, b) => a + b, 0)).toBe(valueCash(3, rate));
  });

  it('matches valueCash for a single payment, and handles refunds', () => {
    const rate = { home: 103000, foreign: 100000 };
    expect(valueSpends([60000], rate)).toEqual([61800]);
    expect(valueSpends([60000, -10000], rate)).toEqual([61800, -10300]);
  });
});

describe('walletBalance', () => {
  it('shows the cash left and what it cost (example A: ¥40,000 worth A$412)', () => {
    expect(walletBalance(exampleA, [60000])).toEqual({ foreign: 40000, home: 41200 });
  });

  it('puts refunded cash back in the wallet', () => {
    expect(walletBalance(exampleA, [60000, -10000])).toEqual({ foreign: 50000, home: 51500 });
  });

  it('reports a negative balance when more was spent than put in, rather than hiding it', () => {
    expect(walletBalance(exampleA, [110000])).toEqual({ foreign: -10000, home: -10300 });
  });

  it('has no home value when there is no rate yet', () => {
    expect(walletBalance([], [500])).toEqual({ foreign: -500, home: null });
  });

  it('keeps spending plus what is left equal to what was paid in', () => {
    const rate = walletRate(exampleA)!;
    const left = walletBalance(exampleA, [60000]);
    expect(valueCash(60000, rate) + (left.home ?? 0)).toBe(103000);
  });

  it('keeps that identity exact even when every payment rounds', () => {
    const topUps = [{ foreignAmount: 3, homeAmount: 1 }];
    const spends = [1, 1];
    const valued = valueSpends(spends, walletRate(topUps)!).reduce((a, b) => a + b, 0);
    expect(valued + (walletBalance(topUps, spends).home ?? 0)).toBe(1);
  });
});
