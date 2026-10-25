import { describe, it, expect } from 'vitest';
import { toCents, formatMoney, formatSignedMoney, distributeEvenly, plainSigned } from '../src/lib/money';

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

import { splitMoney } from '../src/lib/money';

describe('splitMoney', () => {
  it('separates the currency symbol from the amount', () => {
    expect(splitMoney(8829, 'AUD')).toEqual({ symbol: 'A$', amount: '88.29' });
  });

  it('keeps thousands separators in the amount', () => {
    expect(splitMoney(123456, 'USD')).toEqual({ symbol: '$', amount: '1,234.56' });
  });

  it('drops the sign of a negative amount', () => {
    expect(splitMoney(-500, 'AUD')).toEqual({ symbol: 'A$', amount: '5.00' });
  });
});

describe('signed money', () => {
  it('writes a negative amount with a true minus sign', () => {
    expect(formatSignedMoney(-1250, 'AUD', 'en-AU')).toBe('−$12.50');
    expect(formatSignedMoney(1250, 'AUD', 'en-AU')).toBe('$12.50');
    expect(plainSigned(-1250)).toBe('−12.50');
    expect(plainSigned(1250)).toBe('12.50');
  });
});
