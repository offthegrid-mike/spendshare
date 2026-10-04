import { describe, it, expect } from 'vitest';
import { computeSummary } from './settlement';
import { describeBalance, memberName, railStatus, settlementEventText } from './balance';
import { makeGroup } from '../test/fixtures';
import type { SettlementDoc } from '../types/models';

const pair = makeGroup('g1', 'Home'); // uids 'mike', 'priya'
const trio = makeGroup('g2', 'Flat', ['Mike', 'Priya', 'Sam']);

const mikePaid = (amount: number) => [{ amount, shared: true, payerUid: 'mike' }];

describe('memberName', () => {
  it('uses the display name, then the email, then the uid', () => {
    expect(memberName(pair, 'priya')).toBe('Priya');
    const g = makeGroup('g', 'G');
    g.members.priya = { ...g.members.priya, displayName: '' };
    expect(memberName(g, 'priya')).toBe('priya@example.com');
    expect(memberName(pair, 'ghost')).toBe('ghost');
  });
});

describe('describeBalance (2 members)', () => {
  it('says the other person owes you when you are owed', () => {
    const s = computeSummary(pair.memberUids, mikePaid(1000), []);
    expect(describeBalance(s, 'mike', pair, 'October')).toEqual({ label: 'Priya owes you', amount: 500, tone: 'owed' });
  });

  it('says you owe the other person when you owe', () => {
    const s = computeSummary(pair.memberUids, mikePaid(1000), []);
    expect(describeBalance(s, 'priya', pair, 'October')).toEqual({ label: 'You owe Mike', amount: 500, tone: 'owe' });
  });

  it('is all settled when the balance is zero', () => {
    const s = computeSummary(pair.memberUids, [], []);
    expect(describeBalance(s, 'mike', pair, 'October')).toEqual({ label: 'All settled for October', amount: 0, tone: 'settled' });
  });

  it('is all settled once the settlement is paid', () => {
    const s = computeSummary(pair.memberUids, mikePaid(1000), [{ fromUid: 'priya', toUid: 'mike', amount: 500, paid: true }]);
    expect(describeBalance(s, 'mike', pair, 'October').tone).toBe('settled');
  });

  it('treats a viewer outside the group as settled', () => {
    const s = computeSummary(pair.memberUids, mikePaid(1000), []);
    expect(describeBalance(s, 'ghost', pair, 'October').tone).toBe('settled');
  });
});

describe('describeBalance (3+ members)', () => {
  it("uses \"You're owed\" and \"You owe\"", () => {
    const s = computeSummary(trio.memberUids, mikePaid(900), []);
    expect(describeBalance(s, 'mike', trio, 'October')).toEqual({ label: "You're owed", amount: 600, tone: 'owed' });
    expect(describeBalance(s, 'sam', trio, 'October')).toEqual({ label: 'You owe', amount: 300, tone: 'owe' });
  });
});

describe('railStatus', () => {
  it('names the debtor for 2 members', () => {
    const s = computeSummary(pair.memberUids, mikePaid(17658), []);
    expect(railStatus(s, 'mike', pair)).toEqual({ text: 'Priya owes 88.29', tone: 'owed' });
    expect(railStatus(s, 'priya', pair)).toEqual({ text: 'You owe 88.29', tone: 'owe' });
  });

  it("says \"You're owed\" for 3+ members", () => {
    const s = computeSummary(trio.memberUids, mikePaid(900), []);
    expect(railStatus(s, 'mike', trio)).toEqual({ text: "You're owed 6.00", tone: 'owed' });
  });

  it('says Settled at zero', () => {
    expect(railStatus(computeSummary(pair.memberUids, [], []), 'mike', pair)).toEqual({ text: 'Settled', tone: 'settled' });
  });
});

describe('settlementEventText', () => {
  const paidAt = { toDate: () => new Date(2026, 10, 2) } as unknown as SettlementDoc['paidAt'];
  const base: SettlementDoc = { id: 's', month: '2026-10', fromUid: 'priya', toUid: 'mike', amount: 8829, paid: true, paidAt };

  it('reads from the viewer receiving the money', () => {
    expect(settlementEventText(base, 'mike', pair, 'AUD')).toBe('Settled 2 Nov: Priya paid you A$88.29');
  });

  it('reads from the viewer paying', () => {
    expect(settlementEventText(base, 'priya', pair, 'AUD')).toBe('Settled 2 Nov: You paid Mike A$88.29');
  });

  it('names both people when the viewer is neither', () => {
    expect(settlementEventText({ ...base, fromUid: 'sam' }, 'mike', trio, 'AUD').startsWith('Settled 2 Nov: Sam paid you')).toBe(true);
    expect(settlementEventText({ ...base, fromUid: 'sam', toUid: 'priya' }, 'mike', trio, 'AUD')).toBe('Settled 2 Nov: Sam paid Priya A$88.29');
  });

  it('leaves the date out while paidAt is still pending', () => {
    expect(settlementEventText({ ...base, paidAt: undefined }, 'mike', pair, 'AUD')).toBe('Settled: Priya paid you A$88.29');
    expect(settlementEventText({ ...base, paidAt: null as unknown as SettlementDoc['paidAt'] }, 'mike', pair, 'AUD')).toBe('Settled: Priya paid you A$88.29');
  });
});

import { memberBalanceCopy } from './balance';

describe('memberBalanceCopy', () => {
  it.each([
    [8829, true, 'You get back A$88.29', 'owed'],
    [-8829, true, 'You owe A$88.29', 'owe'],
    [0, true, 'Settled', 'settled'],
    [8829, false, 'Gets back A$88.29', 'owed'],
    [-8829, false, 'Owes A$88.29', 'owe'],
    [0, false, 'Settled', 'settled'],
  ] as const)('balance %s (viewer: %s) reads "%s"', (balance, isViewer, text, tone) => {
    expect(memberBalanceCopy(balance, isViewer, 'AUD')).toMatchObject({ text, tone });
  });

  it('also gives the verb and amount separately, for styling the amount', () => {
    expect(memberBalanceCopy(-8829, false, 'AUD')).toMatchObject({ verb: 'Owes', amount: 'A$88.29' });
    expect(memberBalanceCopy(0, true, 'AUD')).toMatchObject({ verb: 'Settled', amount: '' });
  });

  it('never tells a third party that someone "owes you"', () => {
    expect(memberBalanceCopy(-500, false, 'AUD').text).not.toMatch(/you/i);
  });
});
