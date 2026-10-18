import { describe, it, expect } from 'vitest';
import { KNOWN_RATES, resolveRate } from './workRates';

describe('KNOWN_RATES', () => {
  it('holds the fixed rate per income year in cents per hour', () => {
    expect(KNOWN_RATES).toEqual({
      '2020-21': 52,
      '2021-22': 52,
      '2022-23': 67,
      '2023-24': 67,
      '2024-25': 70,
      '2025-26': 70,
    });
  });
});

describe('resolveRate', () => {
  it('carries the latest known rate forward to a year with no rate yet', () => {
    expect(resolveRate('2026-27', {})).toEqual({
      cents: 70,
      source: 'carried',
      carriedFrom: '2025-26',
    });
  });

  it('uses the known rate for a year in the table', () => {
    expect(resolveRate('2024-25', {})).toEqual({ cents: 70, source: 'known' });
    expect(resolveRate('2022-23', {})).toEqual({ cents: 67, source: 'known' });
  });

  it('prefers a rate the user set for that exact year', () => {
    expect(resolveRate('2026-27', { '2026-27': 72 })).toEqual({
      cents: 72,
      source: 'set',
    });
  });

  it('lets a user rate override a known rate for the same year', () => {
    expect(resolveRate('2024-25', { '2024-25': 75 })).toEqual({
      cents: 75,
      source: 'set',
    });
  });

  it('ignores a user rate for a different year', () => {
    expect(resolveRate('2026-27', { '2025-26': 99 })).toEqual({
      cents: 70,
      source: 'carried',
      carriedFrom: '2025-26',
    });
  });

  it('uses the earliest known rate for a year before every known year', () => {
    expect(resolveRate('2019-20', {})).toEqual({
      cents: 52,
      source: 'carried',
      carriedFrom: '2020-21',
    });
  });

  it('accepts a user rate of 0', () => {
    expect(resolveRate('2026-27', { '2026-27': 0 })).toEqual({ cents: 0, source: 'set' });
    expect(resolveRate('2024-25', { '2024-25': 0 })).toEqual({ cents: 0, source: 'set' });
  });

  it('accepts a fractional user rate', () => {
    expect(resolveRate('2026-27', { '2026-27': 72.5 })).toEqual({ cents: 72.5, source: 'set' });
  });

  it('ignores a stored value that is not a finite number of 0 or more, using the known rate', () => {
    const bad: unknown[] = [null, undefined, '72', true, [72], {}, NaN, Infinity, -Infinity, -1, -0.5];
    for (const value of bad) {
      const rates = { '2024-25': value } as unknown as Record<string, number>;
      expect(resolveRate('2024-25', rates), String(value)).toEqual({ cents: 70, source: 'known' });
    }
  });

  it('ignores a stored value that is not a finite number of 0 or more, carrying the rate forward', () => {
    const bad: unknown[] = [null, '72', NaN, Infinity, -1];
    for (const value of bad) {
      const rates = { '2026-27': value } as unknown as Record<string, number>;
      expect(resolveRate('2026-27', rates), String(value)).toEqual({
        cents: 70,
        source: 'carried',
        carriedFrom: '2025-26',
      });
    }
  });

  it('does not read an inherited key as a user rate or a known rate', () => {
    for (const key of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
      expect(resolveRate(key, {}), key).toEqual({ cents: 70, source: 'carried', carriedFrom: '2025-26' });
    }
    // A rate on the prototype of the user's map is not the user's own.
    const inherited = Object.create({ '2026-27': 99 }) as Record<string, number>;
    expect(resolveRate('2026-27', inherited)).toEqual({ cents: 70, source: 'carried', carriedFrom: '2025-26' });
  });

  it('adds no carriedFrom to a set or known result', () => {
    expect('carriedFrom' in resolveRate('2024-25', {})).toBe(false);
    expect('carriedFrom' in resolveRate('2026-27', { '2026-27': 72 })).toBe(false);
  });
});
