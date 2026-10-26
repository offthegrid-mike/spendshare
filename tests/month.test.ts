import { describe, it, expect } from 'vitest';
import {
  monthKey, prevMonthKey, nextMonthKey, formatMonthLabel, monthRange, daysElapsedInMonth, comparablePrevDays, comparisonLabel,
  daysInMonthKey, formatDayMonth, formatDayMonthYear, formatShortMonthYear, dayKey,
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

  describe('comparablePrevDays', () => {
    const noon = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();

    it('is the days gone so far for a month in progress', () => {
      // 11 days into October, against September's first 11.
      expect(comparablePrevDays('2026-10', noon(2026, 10, 11))).toBe(11);
      expect(comparablePrevDays('2026-10', noon(2026, 10, 1))).toBe(1);
    });

    it('is null, meaning all of last month, once the month is over', () => {
      expect(comparablePrevDays('2026-06', noon(2026, 10, 11))).toBeNull();
    });

    it('is null on the last day of the month', () => {
      expect(comparablePrevDays('2026-10', noon(2026, 10, 31))).toBeNull();
    });

    it('is null once the days gone cover the whole of a shorter last month', () => {
      // February has 28 days, so from March 28 there is nothing more of it to leave out.
      expect(comparablePrevDays('2026-03', noon(2026, 3, 27))).toBe(27);
      expect(comparablePrevDays('2026-03', noon(2026, 3, 28))).toBeNull();
      expect(comparablePrevDays('2026-03', noon(2026, 3, 30))).toBeNull();
    });

    it('is 0 for a month that has not started', () => {
      expect(comparablePrevDays('2026-11', noon(2026, 10, 11))).toBe(0);
    });
  });

  describe('daysInMonthKey', () => {
    it('gives the length of the month', () => {
      expect(daysInMonthKey('2026-10')).toBe(31);
      expect(daysInMonthKey('2026-04')).toBe(30);
    });

    it('counts February by leap year', () => {
      expect(daysInMonthKey('2026-02')).toBe(28);
      expect(daysInMonthKey('2024-02')).toBe(29);
      expect(daysInMonthKey('2100-02')).toBe(28);
      expect(daysInMonthKey('2000-02')).toBe(29);
    });
  });

  describe('formatDayMonth', () => {
    it('gives the day and a short month name', () => {
      expect(formatDayMonth('2026-10-12')).toBe('12 Oct');
      expect(formatDayMonth('2026-01-05')).toBe('5 Jan');
      expect(formatDayMonth('2026-09-30')).toBe('30 Sep');
    });
  });

  describe('formatDayMonthYear and formatShortMonthYear', () => {
    it('add the year to the day and month, or leave out the day', () => {
      expect(formatDayMonthYear('2026-10-12')).toBe('12 Oct 2026');
      expect(formatDayMonthYear('2025-01-05')).toBe('5 Jan 2025');
      expect(formatShortMonthYear('2026-10-12')).toBe('Oct 2026');
    });
  });

  describe('dayKey', () => {
    it('is the local day as YYYY-MM-DD', () => {
      expect(dayKey(new Date(2026, 9, 12, 23, 59))).toBe('2026-10-12');
      expect(dayKey(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
    });
  });

  describe('comparisonLabel', () => {
    it('names the month when all of it is compared', () => {
      expect(comparisonLabel('2026-09', null)).toBe('September');
    });

    it('names the stretch of days when only part of the month is compared', () => {
      expect(comparisonLabel('2026-09', 12)).toBe('1–12 September');
    });

    it('names a single day without a range', () => {
      expect(comparisonLabel('2026-09', 1)).toBe('1 September');
    });
  });
});
