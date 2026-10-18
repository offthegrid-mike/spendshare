import { describe, it, expect } from 'vitest';
import { DEFAULT_WORK_SETTINGS, withDefaults } from './workSettings';

describe('DEFAULT_WORK_SETTINGS', () => {
  it('works Monday to Friday, a 7.6 hour day, no rates and no start date', () => {
    expect(DEFAULT_WORK_SETTINGS).toEqual({
      workWeekdays: [1, 2, 3, 4, 5],
      defaultMinutes: 456,
      ratesCentsPerHour: {},
      trackingStartDate: null,
    });
  });
});

describe('withDefaults', () => {
  it('returns the defaults for undefined', () => {
    expect(withDefaults(undefined)).toEqual(DEFAULT_WORK_SETTINGS);
  });

  it('keeps the other defaults when one field is given', () => {
    expect(withDefaults({ defaultMinutes: 450 })).toEqual({
      ...DEFAULT_WORK_SETTINGS,
      defaultMinutes: 450,
    });
  });

  it('takes the rates from the data as given', () => {
    expect(
      withDefaults({ ratesCentsPerHour: { '2026-27': 72 } }).ratesCentsPerHour,
    ).toEqual({ '2026-27': 72 });
  });

  it('takes every field from the data when all are present', () => {
    const data = {
      workWeekdays: [1, 3, 5],
      defaultMinutes: 420,
      ratesCentsPerHour: { '2025-26': 71 },
      trackingStartDate: '2026-07-01',
    };
    expect(withDefaults(data)).toEqual(data);
  });

  it('keeps a null tracking start date and an empty weekday list as given', () => {
    expect(
      withDefaults({ workWeekdays: [], trackingStartDate: null }),
    ).toEqual({ ...DEFAULT_WORK_SETTINGS, workWeekdays: [] });
  });

  it('returns a new object each call', () => {
    const a = withDefaults(undefined);
    const b = withDefaults(undefined);
    expect(a).not.toBe(b);
    expect(a.workWeekdays).not.toBe(b.workWeekdays);
    expect(a.ratesCentsPerHour).not.toBe(b.ratesCentsPerHour);
  });

  it('never lets a change to the result alter the defaults', () => {
    const result = withDefaults(undefined);
    result.workWeekdays.push(6);
    result.ratesCentsPerHour['2026-27'] = 72;
    result.defaultMinutes = 1;
    result.trackingStartDate = '2026-01-01';

    expect(DEFAULT_WORK_SETTINGS).toEqual({
      workWeekdays: [1, 2, 3, 4, 5],
      defaultMinutes: 456,
      ratesCentsPerHour: {},
      trackingStartDate: null,
    });
    expect(withDefaults(undefined)).toEqual(DEFAULT_WORK_SETTINGS);
  });

  it('does not share the data arrays or objects with the result', () => {
    const data = { workWeekdays: [1, 2], ratesCentsPerHour: { '2026-27': 72 } };
    const result = withDefaults(data);
    result.workWeekdays.push(3);
    result.ratesCentsPerHour['2027-28'] = 73;
    expect(data.workWeekdays).toEqual([1, 2]);
    expect(data.ratesCentsPerHour).toEqual({ '2026-27': 72 });
  });
});
