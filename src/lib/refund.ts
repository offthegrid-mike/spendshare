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
