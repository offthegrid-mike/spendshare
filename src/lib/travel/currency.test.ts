import { describe, it, expect } from 'vitest';
import { minorDigits, toMinor, formatMinor, currencyOptions } from './currency';

describe('minorDigits', () => {
  it('knows currencies with no, two and three decimals', () => {
    expect(minorDigits('JPY')).toBe(0);
    expect(minorDigits('AUD')).toBe(2);
    expect(minorDigits('KWD')).toBe(3);
  });

  it('accepts a lower-case code', () => {
    expect(minorDigits('jpy')).toBe(0);
  });
});

describe('toMinor', () => {
  it('converts typed amounts to each currency’s minor unit', () => {
    expect(toMinor('1500', 'JPY')).toBe(1500);
    expect(toMinor('12.5', 'AUD')).toBe(1250);
    expect(toMinor('1.234', 'KWD')).toBe(1234);
  });

  it('accepts numbers', () => {
    expect(toMinor(12.34, 'AUD')).toBe(1234);
  });

  it('rounds to the minor unit without floating-point drift', () => {
    expect(toMinor('0.29', 'AUD')).toBe(29);
    expect(toMinor('1499.6', 'JPY')).toBe(1500);
  });

  it('ignores thousands separators and spaces', () => {
    expect(toMinor('¥ 15,000'.replace('¥', ''), 'JPY')).toBe(15000);
    expect(toMinor(' 1,234.50 ', 'AUD')).toBe(123450);
  });

  it('reads a comma before one or two final digits as a decimal comma', () => {
    expect(toMinor('12,50', 'EUR')).toBe(1250);
    expect(toMinor('12,5', 'EUR')).toBe(1250);
  });

  it('reads a comma before three digits as a thousands separator', () => {
    expect(toMinor('1,500', 'AUD')).toBe(150000);
    expect(toMinor('1,500', 'JPY')).toBe(1500);
  });

  it('reads European grouping: dots for thousands and a decimal comma', () => {
    expect(toMinor('1.234,50', 'EUR')).toBe(123450);
    expect(toMinor('1,234.50', 'USD')).toBe(123450);
  });

  it('never reads a comma as decimals in a currency with none', () => {
    expect(toMinor('1,50', 'JPY')).toBe(150);
  });

  it('returns NaN for something that is not a number', () => {
    expect(toMinor('abc', 'AUD')).toBeNaN();
    expect(toMinor('', 'JPY')).toBeNaN();
  });
});

describe('formatMinor', () => {
  it('formats with the currency’s own decimals', () => {
    expect(formatMinor(15000, 'JPY')).toBe('¥15,000');
    expect(formatMinor(1250, 'AUD')).toBe('A$12.50');
    expect(formatMinor(1234, 'KWD')).toBe('KWD 1.234'); // Intl puts a no-break space after a code
  });

  it('gives a negative amount a true minus sign, as formatMoney does', () => {
    expect(formatMinor(-1250, 'AUD')).toBe('−A$12.50');
    expect(formatMinor(-500, 'JPY')).toBe('−¥500');
  });
});

describe('an empty or unknown currency code', () => {
  it('does not throw: it assumes two decimals and formats the bare figure', () => {
    expect(minorDigits('')).toBe(2);
    expect(toMinor('5', 'NOT')).toBe(500);
    expect(formatMinor(1250, '')).toBe('12.50');
    expect(formatMinor(-1250, 'XX')).toBe('−XX 12.50');
  });
});

describe('currencyOptions', () => {
  it('lists common travel currencies with their names, without duplicates', () => {
    const options = currencyOptions();
    const codes = options.map((o) => o.code);
    expect(codes).toEqual(expect.arrayContaining(['AUD', 'USD', 'EUR', 'GBP', 'JPY', 'KRW', 'THB']));
    expect(new Set(codes).size).toBe(codes.length);
    expect(options.find((o) => o.code === 'JPY')?.name).toBe('Japanese Yen');
  });
});
