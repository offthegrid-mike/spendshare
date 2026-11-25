/**
 * Cash is a payment method with a known cost. Buying foreign cash locks in
 * what it cost in the trip's home currency, and every cash payment is valued
 * at the wallet's weighted average rate: everything paid in ÷ everything
 * received. See docs/TRAVEL_PLAN.md, decision 1.
 *
 * Rates are kept as two integer sums rather than a float, so spending plus
 * what is left always adds back to what was paid in (to the minor unit).
 */

export interface TopUpAmounts {
  /** Minor units of the wallet's currency received. */
  foreignAmount: number;
  /** Minor units of the trip's home currency paid. */
  homeAmount: number;
}

export interface WalletRate { home: number; foreign: number; }

/** The wallet's average rate as home ÷ foreign sums; null until cash has been put in. */
export function walletRate(topUps: TopUpAmounts[]): WalletRate | null {
  let home = 0;
  let foreign = 0;
  for (const t of topUps) { home += t.homeAmount; foreign += t.foreignAmount; }
  return foreign > 0 ? { home, foreign } : null;
}

/** Foreign cash in home minor units at the wallet's rate. Rounds half away from zero, so a refund is exactly minus the spend. */
export function valueCash(foreignAmount: number, rate: WalletRate): number {
  const value = Math.round((Math.abs(foreignAmount) * rate.home) / rate.foreign);
  return foreignAmount < 0 ? -value : value + 0; // + 0 turns -0 into 0
}

/**
 * Cash left in the wallet and its home value. `spends` are foreign amounts
 * paid out, negative for cash refunded into the wallet. A negative balance
 * (more spent than put in) is reported as it is, for the screen to flag.
 */
export function walletBalance(
  topUps: TopUpAmounts[],
  spends: number[],
): { foreign: number; home: number | null } {
  const rate = walletRate(topUps);
  const paidIn = topUps.reduce((s, t) => s + t.foreignAmount, 0);
  const foreign = paidIn - spends.reduce((s, x) => s + x, 0);
  return { foreign, home: rate ? valueCash(foreign, rate) : null };
}
