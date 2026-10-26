import { describe, it, expect } from 'vitest';
import { dayDate, dayNumber, timeTicks } from './timeTicks';

describe('dayNumber and dayDate', () => {
  it('count whole days from 1 January 1970', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber('1970-01-02')).toBe(1);
    expect(dayNumber('2026-10-12') - dayNumber('2026-10-01')).toBe(11);
  });

  it('round-trip through each other', () => {
    expect(dayDate(dayNumber('2026-02-28') + 1)).toBe('2026-03-01');
    expect(dayDate(dayNumber('2028-02-28') + 1)).toBe('2028-02-29');
  });
});

describe('timeTicks', () => {
  const span = (from: string, to: string) => timeTicks(dayNumber(from), dayNumber(to));

  it('spaces a few days evenly across a short stretch, labelled by day', () => {
    const { ticks, unit } = span('2026-10-01', '2026-10-13');
    expect(unit).toBe('day');
    expect(ticks.map(dayDate)).toEqual(['2026-10-01', '2026-10-05', '2026-10-09', '2026-10-13']);
  });

  it('does not repeat a day when the stretch is very short', () => {
    expect(span('2026-10-01', '2026-10-03').ticks.map(dayDate)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(span('2026-10-01', '2026-10-01').ticks.map(dayDate)).toEqual(['2026-10-01']);
  });

  it('puts a tick on the first of each month across half a year, labelled by month', () => {
    const { ticks, unit } = span('2026-04-12', '2026-10-12');
    expect(unit).toBe('month');
    expect(ticks.map(dayDate)).toEqual(['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01']);
  });

  it('skips months as the stretch grows, so there are never more than six', () => {
    expect(span('2025-10-10', '2026-10-12').ticks.map(dayDate)).toEqual([
      '2025-11-01', '2026-01-01', '2026-03-01', '2026-05-01', '2026-07-01', '2026-09-01',
    ]);
    expect(span('2023-01-15', '2026-10-12').ticks.map(dayDate)).toEqual(['2023-02-01', '2024-02-01', '2025-02-01', '2026-02-01']);
  });

  it('keeps every tick inside the stretch', () => {
    const lo = dayNumber('2026-04-12');
    const hi = dayNumber('2026-10-12');
    for (const t of timeTicks(lo, hi).ticks) {
      expect(t).toBeGreaterThanOrEqual(lo);
      expect(t).toBeLessThanOrEqual(hi);
    }
  });
});
