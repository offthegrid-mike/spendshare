import { describe, it, expect } from 'vitest';
import { addTag, cleanTag, removeTag, sharedTags, tagExpenses, tagKey, tagTotals, MAX_TAGS } from './tags';
import { makeExpense, makeItem } from '../test/fixtures';

describe('cleanTag', () => {
  it('collapses whitespace and trims', () => {
    expect(cleanTag('  Holiday   2026 ')).toBe('Holiday 2026');
  });

  it('keeps at most 40 characters', () => {
    expect(cleanTag('x'.repeat(50))).toHaveLength(40);
  });
});

describe('tagKey', () => {
  it('matches tags whatever their case or spacing', () => {
    expect(tagKey(' holiday  2026')).toBe(tagKey('Holiday 2026'));
  });
});

describe('addTag', () => {
  it('adds a cleaned tag', () => {
    expect(addTag(['Renovation'], '  Holiday 2026 ')).toEqual(['Renovation', 'Holiday 2026']);
  });

  it('skips a tag that is already there in another case, or blank', () => {
    expect(addTag(['Holiday'], 'holiday')).toEqual(['Holiday']);
    expect(addTag(['Holiday'], '   ')).toEqual(['Holiday']);
  });

  it(`stops at ${MAX_TAGS} tags`, () => {
    const full = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`);
    expect(addTag(full, 'one more')).toEqual(full);
  });
});

describe('removeTag', () => {
  it('removes a tag whatever its case', () => {
    expect(removeTag(['Holiday', 'Renovation'], 'HOLIDAY')).toEqual(['Renovation']);
  });
});

describe('sharedTags', () => {
  it('is the tags every item has, in the first item’s order', () => {
    expect(sharedTags([
      { tags: ['Holiday', 'Food'] },
      { tags: ['food', 'Holiday', 'Snacks'] },
    ])).toEqual(['Holiday', 'Food']);
  });

  it('is empty without items, or when an item has no tags', () => {
    expect(sharedTags([])).toEqual([]);
    expect(sharedTags([{ tags: ['Holiday'] }, {}])).toEqual([]);
  });
});

describe('tag totals', () => {
  const trip = makeExpense('e1', { shopName: 'Qantas', day: '2026-09-02' });
  const shop = makeExpense('e2', { shopName: 'Coles', day: '2026-10-05' });
  const refund = makeExpense('r1', { shopName: 'Qantas', day: '2026-10-08', kind: 'refund', refundOf: 'e1' });
  const expenses = [refund, shop, trip]; // newest first, as the history comes
  const itemsByExpense = {
    e1: [makeItem('i1', 'e1', { amount: 50000, tags: ['Holiday 2026'] })],
    e2: [
      makeItem('i2', 'e2', { amount: 3000, tags: ['holiday 2026', 'Snacks'] }),
      makeItem('i3', 'e2', { amount: 2000 }),
    ],
    r1: [makeItem('i4', 'r1', { amount: 10000, refund: true, tags: ['Holiday 2026'] })],
  };

  it('totals each tag from its items, refunds taken off, biggest first', () => {
    expect(tagTotals(expenses, itemsByExpense)).toEqual([
      { tag: 'Holiday 2026', amount: 43000, items: 3, expenses: 3, lastMonth: '2026-10' },
      { tag: 'Snacks', amount: 3000, items: 1, expenses: 1, lastMonth: '2026-10' },
    ]);
  });

  it("lists a tag's expenses with what each spent on it, newest first", () => {
    expect(tagExpenses('HOLIDAY 2026', expenses, itemsByExpense)).toEqual([
      { expense: refund, amount: -10000 },
      { expense: shop, amount: 3000 },
      { expense: trip, amount: 50000 },
    ]);
  });
});

describe('odd tags', () => {
  it('refuses a tag that is only dots, which would break its page path', () => {
    expect(addTag([], '.')).toEqual([]);
    expect(addTag([], ' .. ')).toEqual([]);
    expect(addTag([], '...ok')).toEqual(['...ok']);
  });

  it('ignores tags that are not text rather than failing', () => {
    const odd = makeExpense('e9', { day: '2026-10-01' });
    const items = { e9: [makeItem('i9', 'e9', { tags: [42 as unknown as string, 'Real'] })] };
    expect(tagTotals([odd], items).map((t) => t.tag)).toEqual(['Real']);
    expect(sharedTags(items.e9)).toEqual(['Real']);
  });
});
