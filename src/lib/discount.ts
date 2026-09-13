/**
 * Computes the cents amount of a percentage discount (e.g. a credit-card
 * cashback/rebate) applied to whatever is left of the receipt total after
 * any gift card amount has already been subtracted.
 *
 * Returns 0 when there's nothing to discount: `pct` is undefined, NaN, or
 * <= 0, or `afterGiftCardCents` is <= 0. `pct` is clamped to [0, 100] so the
 * result can never exceed `afterGiftCardCents`.
 */
export function computeDiscountCents(afterGiftCardCents: number, pct: number | undefined): number {
  if (pct === undefined || Number.isNaN(pct) || pct <= 0) return 0;
  if (afterGiftCardCents <= 0) return 0;
  const clampedPct = Math.min(pct, 100);
  const pctBasisPoints = Math.round(clampedPct * 100); // e.g. 2.5% -> 250 basis points
  return Math.round((afterGiftCardCents * pctBasisPoints) / 10000);
}
