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
