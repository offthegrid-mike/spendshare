import { describe, it, expect } from 'vitest';
import { computeDiscountCents } from './discount';

describe('computeDiscountCents', () => {
  it('returns 0 when pct is undefined', () => {
    expect(computeDiscountCents(1000, undefined)).toBe(0);
  });

  it('returns 0 when pct is NaN', () => {
    expect(computeDiscountCents(1000, NaN)).toBe(0);
  });

  it('returns 0 when pct is zero or negative', () => {
    expect(computeDiscountCents(1000, 0)).toBe(0);
    expect(computeDiscountCents(1000, -5)).toBe(0);
  });

  it('returns 0 when the remaining amount is zero or negative', () => {
    expect(computeDiscountCents(0, 2)).toBe(0);
    expect(computeDiscountCents(-100, 2)).toBe(0);
  });

  it('computes a simple percentage', () => {
    expect(computeDiscountCents(10000, 2)).toBe(200); // 2% of $100.00 = $2.00
  });

  it('rounds to the nearest cent', () => {
    expect(computeDiscountCents(999, 2)).toBe(20); // 999 * 2 / 100 = 19.98 -> 20
    expect(computeDiscountCents(333, 10)).toBe(33); // 333 * 10 / 100 = 33.3 -> 33
  });

  it('rounds an exact half-cent tie correctly despite binary floating-point representation', () => {
    expect(computeDiscountCents(250, 64.6)).toBe(162); // 250 * 64.6 / 100 = 161.5 exactly -> rounds to 162
  });

  it('supports fractional percentages', () => {
    expect(computeDiscountCents(10000, 2.5)).toBe(250);
  });

  it('clamps a percentage above 100 down to 100', () => {
    expect(computeDiscountCents(10000, 150)).toBe(10000);
  });

  it('returns the full amount at exactly 100%', () => {
    expect(computeDiscountCents(4999, 100)).toBe(4999);
  });
});
