import { describe, it, expect } from 'vitest';
import {
  monthKey, prevMonthKey, nextMonthKey, formatMonthLabel, monthRange, daysElapsedInMonth, comparablePrevShare,
} from '../src/lib/month';
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

  describe('daysElapsedInMonth', () => {
    const noon = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();

    it('is the full length of a month that has finished', () => {
      expect(daysElapsedInMonth('2026-06', noon(2026, 10, 11))).toBe(30);
      expect(daysElapsedInMonth('2026-07', noon(2026, 10, 11))).toBe(31);
    });

    it('knows February in leap and non-leap years', () => {
      expect(daysElapsedInMonth('2028-02', noon(2028, 10, 1))).toBe(29);
      expect(daysElapsedInMonth('2026-02', noon(2026, 10, 1))).toBe(28);
      expect(daysElapsedInMonth('1900-02', noon(2026, 10, 1))).toBe(28);
      expect(daysElapsedInMonth('2000-02', noon(2026, 10, 1))).toBe(29);
    });

    it('is the day of the month so far for the current month', () => {
      expect(daysElapsedInMonth('2026-10', noon(2026, 10, 11))).toBe(11);
      expect(daysElapsedInMonth('2026-10', noon(2026, 10, 1))).toBe(1);
    });

    it('is 0 for a month that has not started', () => {
      expect(daysElapsedInMonth('2026-11', noon(2026, 10, 11))).toBe(0);
    });
  });

  describe('comparablePrevShare', () => {
    const noon = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();

    it('is all of the previous month once the month is over', () => {
      expect(comparablePrevShare('2026-06', noon(2026, 10, 11))).toBe(1);
    });

    it('is as many days of the previous month as have passed, while the month is in progress', () => {
      // 11 days into October, against September's 30.
      expect(comparablePrevShare('2026-10', noon(2026, 10, 11))).toBeCloseTo(11 / 30);
      // 15 days into March, against February's 28.
      expect(comparablePrevShare('2026-03', noon(2026, 3, 15))).toBeCloseTo(15 / 28);
    });

    it('is all of it on the last day of the month', () => {
      expect(comparablePrevShare('2026-10', noon(2026, 10, 31))).toBe(1);
    });

    it('is none of it for a month that has not started', () => {
      expect(comparablePrevShare('2026-11', noon(2026, 10, 11))).toBe(0);
    });
  });
});
