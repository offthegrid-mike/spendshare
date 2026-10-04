import { describe, it, expect } from 'vitest';
import { computeAdjustment } from './adjustment';

describe('computeAdjustment', () => {
  it('is the plain total without gift card or discount', () => {
    expect(computeAdjustment({ total: 4250 })).toEqual({
      total: 4250, giftCard: 0, discount: 0, discountPct: 0, net: 4250, hasAdjustment: false,
    });
  });

  it('applies the gift card first, then the discount on the remainder', () => {
    // 3965 - 2000 = 1965; 2% of 1965 = 39.3 → 39
    expect(computeAdjustment({ total: 3965, giftCardAmount: 2000, discountPercent: 2 })).toEqual({
      total: 3965, giftCard: 2000, discount: 39, discountPct: 2, net: 1926, hasAdjustment: true,
    });
  });

  it('clamps the shown percentage to 0..100', () => {
    const a = computeAdjustment({ total: 1000, discountPercent: 150 });
    expect(a.discountPct).toBe(100);
    expect(a.net).toBe(0);
  });
});
