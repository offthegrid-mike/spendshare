import { describe, it, expect } from 'vitest';
import { schema } from './expenseForm';

function baseValues(overrides: Record<string, unknown> = {}) {
  return {
    date: '2026-09-13',
    shopName: 'Woolworths',
    payerUid: 'u1',
    giftCardAmount: '',
    applyDiscount: false,
    discountPercent: '',
    items: [{ name: 'Milk', categoryId: 'c1', amount: '4.50', quantity: '1', shared: true, remark: '' }],
    ...overrides,
  };
}

describe('expenseForm schema — discountPercent', () => {
  it('passes when applyDiscount is false, regardless of discountPercent content', () => {
    expect(schema.safeParse(baseValues({ applyDiscount: false, discountPercent: 'garbage' })).success).toBe(true);
  });

  it('passes with a valid whole-number percent when applyDiscount is true', () => {
    expect(schema.safeParse(baseValues({ applyDiscount: true, discountPercent: '2' })).success).toBe(true);
  });

  it('passes with a fractional percent when applyDiscount is true', () => {
    expect(schema.safeParse(baseValues({ applyDiscount: true, discountPercent: '2.5' })).success).toBe(true);
  });

  it('fails when applyDiscount is true and discountPercent is blank', () => {
    expect(schema.safeParse(baseValues({ applyDiscount: true, discountPercent: '' })).success).toBe(false);
  });

  it('fails when applyDiscount is true and discountPercent is not a number', () => {
    expect(schema.safeParse(baseValues({ applyDiscount: true, discountPercent: 'abc' })).success).toBe(false);
  });

  it('fails when applyDiscount is true and discountPercent is out of range', () => {
    expect(schema.safeParse(baseValues({ applyDiscount: true, discountPercent: '-1' })).success).toBe(false);
    expect(schema.safeParse(baseValues({ applyDiscount: true, discountPercent: '101' })).success).toBe(false);
  });

  it('passes at the boundary values 0 and 100', () => {
    expect(schema.safeParse(baseValues({ applyDiscount: true, discountPercent: '0' })).success).toBe(true);
    expect(schema.safeParse(baseValues({ applyDiscount: true, discountPercent: '100' })).success).toBe(true);
  });
});
