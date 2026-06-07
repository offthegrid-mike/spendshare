import { describe, it, expect } from 'vitest';
import { monthKey } from '../src/lib/month';
describe('month', () => {
  it('formats a date as YYYY-MM', () => {
    expect(monthKey(new Date('2026-06-07T00:00:00'))).toBe('2026-06');
  });
});
