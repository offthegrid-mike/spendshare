import { describe, it, expect } from 'vitest';
import { computeSummary, PaidSettlement } from '../src/lib/settlement';

const members = ['alice', 'bob', 'carol'];
const items = [
  { amount: 9000, shared: true,  payerUid: 'alice' },
  { amount: 3000, shared: true,  payerUid: 'bob' },
  { amount: 1500, shared: false, payerUid: 'carol' },
];

describe('computeSummary', () => {
  it('computes per-person paid totals', () => {
    expect(computeSummary(members, items, []).paidTotal).toEqual({ alice: 9000, bob: 3000, carol: 1500 });
  });
  it('computes shared total and equal share', () => {
    const s = computeSummary(members, items, []);
    expect(s.sharedTotal).toBe(12000);
    expect(s.shareOf.alice + s.shareOf.bob + s.shareOf.carol).toBe(12000);
    expect(s.shareOf.alice).toBe(4000);
  });
  it('computes balances that sum to zero', () => {
    const s = computeSummary(members, items, []);
    expect(Object.values(s.balance).reduce((a, b) => a + b, 0)).toBe(0);
    expect(s.balance.alice).toBe(5000);
    expect(s.balance.carol).toBe(-4000);
  });
  it('produces minimized settlement transactions', () => {
    const s = computeSummary(members, items, []);
    expect(s.transactions).toEqual(expect.arrayContaining([
      { fromUid: 'carol', toUid: 'alice', amount: 4000 },
      { fromUid: 'bob',   toUid: 'alice', amount: 1000 },
    ]));
    expect(s.transactions).toHaveLength(2);
  });
  it('removes already-paid debts from outstanding transactions', () => {
    const paid: PaidSettlement[] = [{ fromUid: 'carol', toUid: 'alice', amount: 4000, paid: true }];
    expect(computeSummary(members, items, paid).transactions).toEqual([{ fromUid: 'bob', toUid: 'alice', amount: 1000 }]);
  });
  it('distributes remainder cents to first-alphabetical member', () => {
    // 3 members, sharedTotal = 10 cents → alice:4, bob:3, carol:3
    const s = computeSummary(['alice', 'bob', 'carol'], [{ amount: 10, shared: true, payerUid: 'alice' }], []);
    expect(s.shareOf.alice + s.shareOf.bob + s.shareOf.carol).toBe(10);
    expect(s.sharedTotal).toBe(10);
  });
  it('ignores settlements with paid: false', () => {
    const unpaid: PaidSettlement[] = [{ fromUid: 'carol', toUid: 'alice', amount: 4000, paid: false }];
    const s = computeSummary(members, items, unpaid);
    expect(s.transactions).toEqual(expect.arrayContaining([
      { fromUid: 'carol', toUid: 'alice', amount: 4000 },
      { fromUid: 'bob',   toUid: 'alice', amount: 1000 },
    ]));
    expect(s.transactions).toHaveLength(2);
  });
});

describe('computeSummary paidShared', () => {
  it('totals only shared items per payer', () => {
    expect(computeSummary(members, items, []).paidShared).toEqual({ alice: 9000, bob: 3000, carol: 0 });
  });

  it('includes a payer who is no longer a member', () => {
    const s = computeSummary(['alice'], [{ amount: 500, shared: true, payerUid: 'gone' }], []);
    expect(s.paidShared).toEqual({ alice: 0, gone: 500 });
  });
});

describe('computeSummary with refunds', () => {
  it('takes a shared refund off the shared total and off the payer who got the money back', () => {
    const s = computeSummary(['alice', 'bob'], [
      { amount: 10000, shared: true, payerUid: 'alice' },
      { amount: 4000, shared: true, payerUid: 'alice', refund: true },
    ], []);
    expect(s.sharedTotal).toBe(6000);
    expect(s.paidTotal.alice).toBe(6000);
    expect(s.balance).toEqual({ alice: 3000, bob: -3000 });
    expect(s.transactions).toEqual([{ fromUid: 'bob', toUid: 'alice', amount: 3000 }]);
  });

  it('settles a month that only has a refund, with balances that still sum to zero', () => {
    const s = computeSummary(['alice', 'bob'], [{ amount: 1001, shared: true, payerUid: 'alice', refund: true }], []);
    expect(s.sharedTotal).toBe(-1001);
    expect(s.balance.alice + s.balance.bob).toBe(0);
    expect(s.transactions).toEqual([{ fromUid: 'alice', toUid: 'bob', amount: s.balance.bob }]);
  });
});

describe('computeSummary with a personal refund', () => {
  it('gives a personal refund back to its payer without touching the shared split', () => {
    const s = computeSummary(['alice', 'bob'], [
      { amount: 10000, shared: true, payerUid: 'alice' },
      { amount: 3000, shared: false, payerUid: 'bob' },
      { amount: 1000, shared: false, payerUid: 'bob', refund: true },
    ], []);
    expect(s.sharedTotal).toBe(10000);
    expect(s.paidTotal.bob).toBe(2000);
    expect(s.balance).toEqual({ alice: 5000, bob: -5000 });
  });
});
