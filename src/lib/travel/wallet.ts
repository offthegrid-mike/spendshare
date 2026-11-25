/**
 * Cash is a payment method with a known cost. Buying foreign cash locks in
 * what it cost in the trip's home currency, and every cash payment is valued
 * at the wallet's weighted average rate: everything paid in ÷ everything
 * received. See docs/TRAVEL_PLAN.md, decision 1.
 *
 * Rates are kept as two integer sums rather than a float. Payments are
 * valued cumulatively (valueSpends) and the cash left is what was paid in
 * less the value of everything spent (walletBalance), so spending plus what
 * is left always adds back to exactly what was paid in.
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

/**
 * Foreign cash in home minor units at the wallet's rate, for one amount on
 * its own. Rounds half away from zero, so a refund is exactly minus the spend.
 * To value a wallet's payments, use valueSpends so the rounding doesn't add up.
 */
export function valueCash(foreignAmount: number, rate: WalletRate): number {
  const value = Math.round((Math.abs(foreignAmount) * rate.home) / rate.foreign);
  return (foreignAmount < 0 ? -value : value) + 0; // + 0 turns -0 into 0
}

/**
 * Each payment's home value, in the order given: the value of everything
 * spent up to and including it, less the value of everything before it.
 * The values add up to exactly valueCash of the total, however many there are.
 */
export function valueSpends(spends: number[], rate: WalletRate): number[] {
  let spent = 0;
  let valued = 0;
  return spends.map((amount) => {
    spent += amount;
    const next = valueCash(spent, rate);
    const value = next - valued;
    valued = next;
    return value + 0;
  });
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
  const spent = spends.reduce((s, x) => s + x, 0);
  const foreign = topUps.reduce((s, t) => s + t.foreignAmount, 0) - spent;
  return { foreign, home: rate ? rate.home - valueCash(spent, rate) : null };
}
