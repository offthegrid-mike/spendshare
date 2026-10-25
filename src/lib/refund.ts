import { computeAdjustment } from './adjustment';
import type { ExpenseDoc, ItemDoc } from '../types/models';

/**
 * Refunds are stored with positive amounts, marked `kind: 'refund'` on the
 * expense and `refund: true` on each of its items. Every sum of money goes
 * through these, so a refund comes off spending, shares and balances.
 */

export function isRefund(expense: Pick<ExpenseDoc, 'kind'>): boolean {
  return expense.kind === 'refund';
}

/** An item's amount in whole cents, negative for a refund. */
export function signedAmount(item: Pick<ItemDoc, 'amount' | 'refund'>): number {
  const amount = Math.round(item.amount);
  return item.refund ? -amount : amount;
}

/** What an expense cost after gift card and discount, negative for a refund. */
export function signedNet(expense: Pick<ExpenseDoc, 'total' | 'giftCardAmount' | 'discountPercent' | 'kind'>): number {
  const { net } = computeAdjustment(expense);
  return isRefund(expense) ? -net : net;
}

/**
 * How much of an expense can still be refunded: what was paid for it, less
 * the refunds already made (a refund's total, as refunds have no gift card or
 * discount). `excludeId` leaves out the refund being edited.
 */
export function remainingToRefund(
  original: Pick<ExpenseDoc, 'total' | 'giftCardAmount' | 'discountPercent'>,
  refunds: Pick<ExpenseDoc, 'id' | 'total'>[],
  excludeId?: string,
): number {
  const refunded = refunds.filter((r) => r.id !== excludeId).reduce((sum, r) => sum + r.total, 0);
  return Math.max(computeAdjustment(original).net - refunded, 0);
}
