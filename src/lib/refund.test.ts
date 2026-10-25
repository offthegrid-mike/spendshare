import { describe, it, expect } from 'vitest';
import { isRefund, signedAmount, signedNet } from './refund';
import { makeExpense } from '../test/fixtures';

describe('signedAmount', () => {
  it('counts a purchase item as spent, rounded to whole cents', () => {
    expect(signedAmount({ amount: 1000.4 })).toBe(1000);
  });

  it('counts a refund item against spending', () => {
    expect(signedAmount({ amount: 1000.4, refund: true })).toBe(-1000);
  });
});

describe('signedNet', () => {
  it('is what was paid for a purchase, after gift card and discount', () => {
    expect(signedNet(makeExpense('e1', { total: 10000, giftCardAmount: 2000 }))).toBe(8000);
  });

  it('is negative for a refund', () => {
    expect(signedNet(makeExpense('r1', { total: 3000, kind: 'refund', refundOf: 'e1' }))).toBe(-3000);
  });
});

describe('isRefund', () => {
  it('tells a refund from a purchase', () => {
    expect(isRefund(makeExpense('r1', { kind: 'refund', refundOf: 'e1' }))).toBe(true);
    expect(isRefund(makeExpense('e1'))).toBe(false);
  });
});
