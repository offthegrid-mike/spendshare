import { describe, it, expect } from 'vitest';
import { monthKey, prevMonthKey, nextMonthKey, formatMonthLabel, monthRange } from '../src/lib/month';
describe('month', () => {
  it('formats a date as YYYY-MM', () => {
    expect(monthKey(new Date('2026-06-07T00:00:00'))).toBe('2026-06');
  });

  it('steps back across a year boundary', () => {
    expect(prevMonthKey('2026-01')).toBe('2025-12');
    expect(prevMonthKey('2026-06')).toBe('2026-05');
  });

  it('steps forward across a year boundary', () => {
    expect(nextMonthKey('2025-12')).toBe('2026-01');
    expect(nextMonthKey('2026-05')).toBe('2026-06');
  });

  it('labels a month key as "Month YYYY"', () => {
    expect(formatMonthLabel('2026-10')).toBe('October 2026');
  });

  it('lists months between two keys, newest first, inclusive', () => {
    expect(monthRange('2025-11', '2026-02')).toEqual(['2026-02', '2026-01', '2025-12', '2025-11']);
  });

  it('lists a single month when both ends are equal', () => {
    expect(monthRange('2026-03', '2026-03')).toEqual(['2026-03']);
  });

  it('lists nothing when the start is after the end', () => {
    expect(monthRange('2026-03', '2026-02')).toEqual([]);
  });
});
