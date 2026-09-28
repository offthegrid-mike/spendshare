import { describe, it, expect } from 'vitest';
import { formatCompactMoney } from './money';

describe('formatCompactMoney', () => {
  it('abbreviates thousands with one decimal', () => {
    expect(formatCompactMoney(123456, 'USD')).toBe('$1.2K');
  });

  it('leaves small amounts unabbreviated', () => {
    expect(formatCompactMoney(5000, 'USD')).toBe('$50');
  });

  it('formats zero', () => {
    expect(formatCompactMoney(0, 'USD')).toBe('$0');
  });
});
