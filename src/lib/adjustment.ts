import { computeDiscountCents } from './discount';
import type { ExpenseDoc } from '../types/models';

export interface Adjustment {
  /** Receipt total, in cents. */
  total: number;
  giftCard: number;
  discount: number;
  /** The discount percentage clamped to 0..100, for display. */
  discountPct: number;
  /** What was actually paid: total - gift card - discount. */
  net: number;
  hasAdjustment: boolean;
}

/**
 * Gift card first, then the percentage discount off the remainder, the same
 * order as the expense editor's totals. Display-only: settlement math uses
 * item amounts and ignores both.
 */
export function computeAdjustment(exp: Pick<ExpenseDoc, 'total' | 'giftCardAmount' | 'discountPercent'>): Adjustment {
  const giftCard = exp.giftCardAmount ?? 0;
  const afterGiftCard = exp.total - giftCard;
  const discount = computeDiscountCents(afterGiftCard, exp.discountPercent);
  return {
    total: exp.total,
    giftCard,
    discount,
    discountPct: Math.min(Math.max(exp.discountPercent ?? 0, 0), 100),
    net: afterGiftCard - discount,
    hasAdjustment: giftCard > 0 || discount > 0,
  };
}
