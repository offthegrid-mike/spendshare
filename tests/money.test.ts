import { describe, it, expect } from 'vitest';
import { toCents, formatMoney, distributeEvenly } from '../src/lib/money';

describe('money', () => {
  it('parses dollars to integer cents', () => {
    expect(toCents('1.5')).toBe(150);
    expect(toCents('2.91')).toBe(291);
    expect(toCents('100')).toBe(10000);
  });
  it('formats cents with currency', () => {
    expect(formatMoney(12841, 'AUD')).toBe('A$128.41');
  });
  it('distributes a total into equal integer shares summing exactly to the total', () => {
    const shares = distributeEvenly(10000, ['a', 'b', 'c']);
    expect(shares.a + shares.b + shares.c).toBe(10000);
    expect(Object.values(shares).every((c) => c === 3334 || c === 3333)).toBe(true);
  });
});
