import { describe, it, expect } from 'vitest';
import {
  incomeYearOf,
  incomeYearLabel,
  incomeYearRange,
  shiftIncomeYear,
  weekdayOf,
  addDays,
  clockNow,
} from './workDates';

describe('incomeYearOf', () => {
  it('puts 30 June in the year that started the July before', () => {
    expect(incomeYearOf('2026-06-30')).toBe('2025-26');
  });
  it('starts a new income year on 1 July', () => {
    expect(incomeYearOf('2026-07-01')).toBe('2026-27');
  });
  it('keeps the last day of the year in the same key', () => {
    expect(incomeYearOf('2027-06-30')).toBe('2026-27');
  });
  it('handles a leap day', () => {
    expect(incomeYearOf('2028-02-29')).toBe('2027-28');
  });
  it('turns the century with a two digit end', () => {
    expect(incomeYearOf('1999-07-01')).toBe('1999-00');
  });
});

describe('incomeYearLabel', () => {
  it('joins the years with an en dash', () => {
    expect(incomeYearLabel('2026-27')).toBe('2026–27');
  });
});

describe('incomeYearRange', () => {
  it('runs 1 July to 30 June', () => {
    expect(incomeYearRange('2026-27')).toEqual({ start: '2026-07-01', end: '2027-06-30' });
    expect(incomeYearRange('2027-28')).toEqual({ start: '2027-07-01', end: '2028-06-30' });
  });
});

describe('shiftIncomeYear', () => {
  it('moves back and forward by whole years', () => {
    expect(shiftIncomeYear('2026-27', -1)).toBe('2025-26');
    expect(shiftIncomeYear('2026-27', 1)).toBe('2027-28');
  });
  it('rolls over a century', () => {
    expect(shiftIncomeYear('1999-00', 1)).toBe('2000-01');
  });
});

describe('weekdayOf', () => {
  it('is ISO: 1 Monday to 7 Sunday', () => {
    expect(weekdayOf('2026-10-19')).toBe(1);
    expect(weekdayOf('2026-10-18')).toBe(7);
    expect(weekdayOf('2026-10-17')).toBe(6);
  });
});

describe('addDays', () => {
  it('crosses a month end', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });
  it('steps back over the end of February', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('clockNow', () => {
  it('reads the local date and minutes since midnight', () => {
    expect(clockNow(new Date(2026, 9, 19, 9, 0).getTime())).toEqual({
      today: '2026-10-19',
      nowMinutes: 540,
    });
  });
  it('counts just after midnight as minute 30, not 24 hours', () => {
    expect(clockNow(new Date(2026, 9, 19, 0, 30).getTime())).toEqual({
      today: '2026-10-19',
      nowMinutes: 30,
    });
  });
});
