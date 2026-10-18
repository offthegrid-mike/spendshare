import { describe, it, expect } from 'vitest';
import { paths, legacyTarget } from './paths';

describe('paths', () => {
  it('puts every SpendShare screen under /spend', () => {
    expect(paths.home).toBe('/');
    expect(paths.spend).toBe('/spend');
    expect(paths.summary).toBe('/spend/summary');
    expect(paths.income).toBe('/spend/income');
    expect(paths.search).toBe('/spend/search');
    expect(paths.more).toBe('/spend/more');
    expect(paths.newExpense).toBe('/spend/expense/new');
    expect(paths.editExpense('abc123')).toBe('/spend/expense/abc123/edit');
    expect(paths.categories).toBe('/spend/categories');
    expect(paths.groupSettings).toBe('/spend/group/settings');
    expect(paths.groupInvites).toBe('/spend/group/invites');
  });
});

describe('legacyTarget', () => {
  it.each([
    ['/summary', '/spend/summary'],
    ['/income', '/spend/income'],
    ['/search', '/spend/search'],
    ['/more', '/spend/more'],
    ['/categories', '/spend/categories'],
    ['/group/settings', '/spend/group/settings'],
    ['/group/invites', '/spend/group/invites'],
    ['/expense/new', '/spend/expense/new'],
    ['/expense/abc123/edit', '/spend/expense/abc123/edit'],
  ])('maps %s to %s', (from, to) => expect(legacyTarget(from)).toBe(to));

  it.each(['/', '/spend', '/spend/summary', '/work', '/nope', '/expense'])('leaves %s alone', (p) =>
    expect(legacyTarget(p)).toBeNull());
});
