import { minorDigits } from './currency';
import { createdMillis, expenseDay } from './tripExpense';
import { valueCash, walletRate, type WalletRate } from './wallet';
import { spreadInProportion } from './spread';
import type { ExpenseDoc, TopUpDoc, WalletDoc } from '../../types/models';

/**
 * Cash wallets (docs/TRAVEL_PLAN.md, T4). Cash bought before or during a trip
 * locks in what it cost. Each cash payment is valued at a running average:
 * top-ups and payments are taken in date order (top-ups first on a day,
 * payments by when they were added), and a payment draws from the cash
 * bought up to then. So buying more cash later never changes what an earlier
 * payment was worth, and because each payment's value comes out of the pool,
 * a wallet's spending plus what's left always equals exactly what its cash cost.
 */

export function walletIdFor(ownerUid: string, currency: string): string {
  return `${ownerUid}_${currency}`;
}

/** The trip's shared kitty in a currency. Its id is also its party in the balances. */
export function kittyIdFor(currency: string): string {
  return `kitty_${currency}`;
}

export function isKittyId(id: string): boolean {
  return id.startsWith('kitty_');
}

export interface KittyContributor {
  uid: string;
  /** Cash put in, and what it cost, in minor units. */
  foreign: number;
  home: number;
  /** Their share of the cash left, handed back in proportion to the cash each put in, and its cost. */
  handBack: number;
  handBackHome: number;
  /** What they're credited with in the balances: what they put in, less what they get back. */
  credit: number;
}

/** A settle-up-like credit that moves value from a person to the kitty's party. */
export interface KittyCredit { fromUid: string; toUid: string; amount: number; paid: true; }

export interface WalletState {
  wallet: WalletDoc;
  /** Oldest first. */
  topUps: TopUpDoc[];
  rate: WalletRate | null;
  paidIn: { foreign: number; home: number };
  /** Foreign minor units paid out in cash. */
  spent: number;
  /** Cash left, and what it cost in home minor units (null with no rate yet). Negative when overspent. */
  left: { foreign: number; home: number | null };
  /** The average rate of the cash left, which the next payment draws from; the overall rate once it's used up. */
  leftRate: WalletRate | null;
  /** This wallet's payments, in the order they were valued. */
  payments: ExpenseDoc[];
  /** The kitty only: who put in what, and gets back what. */
  kitty?: { contributors: KittyContributor[] };
}

export interface TripCash {
  wallets: WalletState[];
  /** Home value of each cash payment, by expense id; null when its wallet can't value it. */
  values: Record<string, number | null>;
  /**
   * The kitty's credits for valueTrip: each contributor's credit, and what
   * whoever handed over the cash paid beyond what was in the kitty. With the
   * kitty's spending, they leave its party at exactly zero.
   */
  kittyCredits: KittyCredit[];
}

/** When a top-up was added; one still saving counts as the newest. */
function addedAt(t: TopUpDoc): number {
  const ts = t.createdAt as { toMillis?: () => number } | null;
  return ts?.toMillis ? ts.toMillis() : Number.POSITIVE_INFINITY;
}

function spentOrder(a: ExpenseDoc, b: ExpenseDoc): number {
  return expenseDay(a).localeCompare(expenseDay(b)) || createdMillis(a) - createdMillis(b);
}

/**
 * Values one wallet's payments (already in spending order) against its top-ups
 * (oldest first) with a running average. A payment beyond the cash bought by
 * then (spent before the cash was recorded, or overspent) is valued, for that
 * part, at the wallet's overall average.
 */
function runningValues(topUps: TopUpDoc[], payments: ExpenseDoc[], overall: WalletRate): number[] {
  let poolForeign = 0;
  let poolHome = 0;
  let next = 0;
  return payments.map((e) => {
    const day = expenseDay(e);
    while (next < topUps.length && topUps[next].date <= day) {
      poolForeign += topUps[next].foreignAmount;
      poolHome += topUps[next].homeAmount;
      next += 1;
    }
    const covered = Math.min(Math.max(poolForeign, 0), e.total);
    // Draining the pool takes all of its value, so nothing is left over by rounding.
    const fromPool = covered === poolForeign ? poolHome : covered > 0 ? Math.round((covered * poolHome) / poolForeign) : 0;
    poolForeign -= covered;
    poolHome -= fromPool;
    return fromPool + valueCash(e.total - covered, overall);
  });
}

/** Who put what into a kitty, and their share of what's left, in proportion to the cash each put in. */
function kittyContributors(topUps: TopUpDoc[], left: { foreign: number; home: number | null }): KittyContributor[] {
  const byUid = new Map<string, { foreign: number; home: number }>();
  for (const t of topUps) {
    const uid = t.fromUid ?? t.byUid;
    const c = byUid.get(uid) ?? { foreign: 0, home: 0 };
    c.foreign += t.foreignAmount;
    c.home += t.homeAmount;
    byUid.set(uid, c);
  }
  const list = [...byUid.entries()];
  const weights = list.map(([, c]) => c.foreign);
  // Nothing is handed back from a kitty that's used up or overspent.
  const handBack = spreadInProportion(Math.max(left.foreign, 0), weights);
  const handBackHome = left.foreign > 0 && left.home !== null ? spreadInProportion(Math.max(left.home, 0), weights) : weights.map(() => 0);
  return list.map(([uid, c], i) => ({
    uid, foreign: c.foreign, home: c.home, handBack: handBack[i], handBackHome: handBackHome[i], credit: c.home - handBackHome[i],
  }));
}

/**
 * The kitty's credits: each contributor's, and for an overspent kitty, the part
 * of its spending beyond its cost, credited to whoever handed that cash over
 * (they covered it), in proportion to how far past the cash each payment went.
 */
function creditsFor(state: WalletState, valued: (number | null)[]): KittyCredit[] {
  const id = state.wallet.id;
  const credits: KittyCredit[] = state.kitty!.contributors
    .filter((c) => c.credit !== 0)
    .map((c) => ({ fromUid: c.uid, toUid: id, amount: c.credit, paid: true }));
  const spentValue = valued.reduce<number>((s, v) => s + (v ?? 0), 0);
  const credited = credits.reduce((s, c) => s + c.amount, 0);
  const shortfall = spentValue - credited;
  if (shortfall > 0 && state.left.foreign < 0) {
    let cumulative = 0;
    const beyond = state.payments.map((e) => {
      const before = cumulative;
      cumulative += e.total;
      return Math.max(0, Math.min(e.total, cumulative - Math.max(before, state.paidIn.foreign)));
    });
    const parts = spreadInProportion(shortfall, beyond);
    state.payments.forEach((e, i) => {
      if (parts[i] > 0) credits.push({ fromUid: e.payerUid, toUid: id, amount: parts[i], paid: true });
    });
  }
  return credits;
}

export function tripCash(wallets: WalletDoc[], topUps: TopUpDoc[], expenses: ExpenseDoc[]): TripCash {
  const values: Record<string, number | null> = {};
  const kittyCredits: KittyCredit[] = [];
  const byId = new Map(wallets.map((w) => [w.id, w]));
  const cashPayments: ExpenseDoc[] = [];
  for (const e of expenses) {
    if (e.paidWith?.kind !== 'wallet') continue;
    const wallet = byId.get(e.paidWith.walletId);
    // A missing wallet, or one in another currency, can't value the payment: flag it, don't guess.
    if (!wallet || (e.currency ?? '') !== wallet.currency) values[e.id] = null;
    else cashPayments.push(e);
  }

  const states = wallets.map((wallet): WalletState => {
    const own = topUps.filter((t) => t.walletId === wallet.id).sort((a, b) => a.date.localeCompare(b.date) || addedAt(a) - addedAt(b));
    const payments = cashPayments
      .filter((e) => e.paidWith?.kind === 'wallet' && e.paidWith.walletId === wallet.id)
      .sort(spentOrder);
    const rate = walletRate(own);
    const valued: (number | null)[] = rate ? runningValues(own, payments, rate) : payments.map(() => null);
    payments.forEach((e, i) => { values[e.id] = valued[i]; });
    const paidIn = {
      foreign: own.reduce((s, t) => s + t.foreignAmount, 0),
      home: own.reduce((s, t) => s + t.homeAmount, 0),
    };
    const spent = payments.reduce((s, e) => s + e.total, 0);
    const spentValue = valued.reduce<number>((s, v) => s + (v ?? 0), 0);
    const left = { foreign: paidIn.foreign - spent, home: rate ? paidIn.home - spentValue : null };
    const state: WalletState = {
      wallet,
      topUps: own,
      rate,
      paidIn,
      spent,
      left,
      leftRate: left.foreign > 0 && left.home !== null && left.home >= 0 ? { foreign: left.foreign, home: left.home } : rate,
      payments,
    };
    if (wallet.kind === 'kitty') {
      state.kitty = { contributors: kittyContributors(own, left) };
      kittyCredits.push(...creditsFor(state, valued));
    }
    return state;
  });

  return { wallets: states, values, kittyCredits };
}

/** A wallet's average rate as read on an exchange board, "1 home = x foreign", to four significant digits. */
export function readableWalletRate(rate: WalletRate, currency: string, home: string): string {
  const foreignMajor = rate.foreign / 10 ** minorDigits(currency);
  const homeMajor = rate.home / 10 ** minorDigits(home);
  return homeMajor > 0 ? String(Number((foreignMajor / homeMajor).toPrecision(4))) : '–';
}

/** Cash left in a wallet, counting back in what `editing` (an expense being edited) already took from it. */
export function cashLeftFor(cash: TripCash, walletId: string, editing?: ExpenseDoc): number | null {
  const state = cash.wallets.find((w) => w.wallet.id === walletId);
  if (!state) return null;
  const takenByEdit = editing?.paidWith?.kind === 'wallet' && editing.paidWith.walletId === walletId ? editing.total : 0;
  return state.left.foreign + takenByEdit;
}
