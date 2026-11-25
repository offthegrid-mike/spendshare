import { minorDigits } from './currency';
import { createdMillis, expenseDay } from './tripExpense';
import { valueCash, walletRate, type WalletRate } from './wallet';
import { spreadInProportion } from './spread';
import type { ExpenseDoc, HandoverDoc, TopUpDoc, WalletDoc } from '../../types/models';

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
  /** Cash put in, and what it cost them, in minor units. */
  foreign: number;
  home: number;
  /** Their share of the cash left, handed back in proportion to the cash each put in. */
  handBack: number;
}

/**
 * What valueTrip needs to settle a kitty: who put in what, and for each of its
 * payments how far (in foreign units) it went past the cash put in.
 */
export interface KittyInfo {
  walletId: string;
  /** Who keeps the cash left, if one person does; otherwise it's handed back. */
  keptBy?: string;
  currency: string;
  paidIn: { foreign: number; home: number };
  left: { foreign: number; home: number | null };
  contributors: KittyContributor[];
  beyond: Record<string, number>;
}

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
  /** Foreign cash handed to or received from other members to settle up. */
  handedOut: number;
  handedIn: number;
  /** This wallet's hand-overs, both ways, oldest first. */
  handovers: HandoverDoc[];
}

export interface TripCash {
  wallets: WalletState[];
  /** Home value of each cash payment, by expense id; null when its wallet can't value it. */
  values: Record<string, number | null>;
  /** The trip's kitties, for valueTrip to credit their contributors. */
  kitties: KittyInfo[];
  /** Cash hand-overs as payments between members, at what the cash cost the giver. */
  handoverCredits: { fromUid: string; toUid: string; amount: number; paid: true }[];
  /** Each hand-over's value in home minor units, by id; null when the giver has no such cash to value it. */
  handoverValues: Record<string, number | null>;
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
 * Whether cash is in the wallet by the time of a payment. Cash bought counts
 * from the start of its day; cash handed over counts from when it was handed
 * over, so paying back a debt never changes what that day's spending was worth.
 * A hand-over still waiting for the server is the newest.
 */
function arrivedBy(t: TopUpDoc, day: string, payment: ExpenseDoc): boolean {
  if (t.date !== day) return t.date < day;
  return !t.id.startsWith(HANDOVER) || addedAt(t) < createdMillis(payment);
}

/** Pool order: by day, cash bought before cash handed over on a day, then as added. */
function poolOrder(a: TopUpDoc, b: TopUpDoc): number {
  return a.date.localeCompare(b.date)
    || Number(a.id.startsWith(HANDOVER)) - Number(b.id.startsWith(HANDOVER))
    || addedAt(a) - addedAt(b);
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
    while (next < topUps.length && arrivedBy(topUps[next], day, e)) {
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

/**
 * Who put what into a kitty, and their share of what's left: in proportion to
 * the cash each put in, or all of it to `keptBy` when one person keeps it.
 */
function kittyContributors(topUps: TopUpDoc[], left: { foreign: number }, keptBy?: string): KittyContributor[] {
  const byUid = new Map<string, { foreign: number; home: number }>();
  for (const t of topUps) {
    const uid = t.fromUid ?? t.byUid;
    const c = byUid.get(uid) ?? { foreign: 0, home: 0 };
    c.foreign += t.foreignAmount;
    c.home += t.homeAmount;
    byUid.set(uid, c);
  }
  if (keptBy && !byUid.has(keptBy)) byUid.set(keptBy, { foreign: 0, home: 0 });
  const list = [...byUid.entries()];
  // Nothing is handed back from a kitty that's used up or overspent.
  const leftover = Math.max(left.foreign, 0);
  const handBack = keptBy
    ? list.map(([uid]) => (uid === keptBy ? leftover : 0))
    : spreadInProportion(leftover, list.map(([, c]) => c.foreign));
  return list.map(([uid, c], i) => ({ uid, foreign: c.foreign, home: c.home, handBack: handBack[i] }));
}

/** For each payment, in spending order, how far it went past the cash put in. */
function beyondCash(payments: ExpenseDoc[], paidInForeign: number): Record<string, number> {
  const beyond: Record<string, number> = {};
  let cumulative = 0;
  for (const e of payments) {
    const before = cumulative;
    cumulative += e.total;
    beyond[e.id] = Math.max(0, Math.min(e.total, cumulative - Math.max(before, paidInForeign)));
  }
  return beyond;
}

const HANDOVER = 'handover:';

/** A hand-over leaving the giver's wallet, valued like a cash payment. */
function handoverOut(h: HandoverDoc, walletId: string): ExpenseDoc {
  return {
    id: HANDOVER + h.id, total: h.foreignAmount, tripDay: h.date, createdAt: h.createdAt,
    currency: h.currency, paidWith: { kind: 'wallet', walletId },
  } as unknown as ExpenseDoc;
}

/** A hand-over arriving in the receiver's wallet at what it cost the giver. */
function handoverIn(h: HandoverDoc, walletId: string, homeAmount: number): TopUpDoc {
  return {
    id: HANDOVER + h.id, walletId, byUid: h.byUid, date: h.date, foreignAmount: h.foreignAmount, homeAmount, createdAt: h.createdAt,
  } as TopUpDoc;
}

/**
 * Every wallet's cash, the home value of every cash payment and hand-over, and
 * each kitty's facts. Hand-overs move cash between members' wallets: one leaves
 * the giver's wallet like a payment and arrives in the receiver's like a top-up
 * at that cost. When one wallet's hand-overs depend on another's, the wallets
 * are valued again until the values settle (one pass per link in the chain).
 */
export function tripCash(
  wallets: WalletDoc[],
  topUps: TopUpDoc[],
  expenses: ExpenseDoc[],
  handovers: HandoverDoc[] = [],
): TripCash {
  const byId = new Map(wallets.map((w) => [w.id, w]));
  const flagged: Record<string, number | null> = {};
  const cashPayments: ExpenseDoc[] = [];
  for (const e of expenses) {
    if (e.paidWith?.kind !== 'wallet') continue;
    const wallet = byId.get(e.paidWith.walletId);
    // A missing wallet, or one in another currency, can't value the payment: flag it, don't guess.
    if (!wallet || (e.currency ?? '') !== wallet.currency) flagged[e.id] = null;
    else cashPayments.push(e);
  }
  // A hand-over needs the giver's own cash in that currency to be valued.
  const valid = handovers.filter((h) => h.fromUid !== h.toUid && byId.get(walletIdFor(h.fromUid, h.currency))?.kind === 'personal');

  let handoverValues: Record<string, number | null> = Object.fromEntries(handovers.map((h) => [h.id, null]));
  let result = valueWallets(wallets, topUps, cashPayments, valid, handoverValues);
  for (let pass = 0; pass < wallets.length; pass += 1) {
    const next = { ...handoverValues, ...result.handoverValues };
    if (valid.every((h) => next[h.id] === handoverValues[h.id])) break;
    handoverValues = next;
    result = valueWallets(wallets, topUps, cashPayments, valid, handoverValues);
  }
  handoverValues = { ...handoverValues, ...result.handoverValues };

  return {
    wallets: result.states,
    values: { ...flagged, ...result.values },
    kitties: result.kitties,
    handoverValues,
    handoverCredits: valid
      .filter((h) => handoverValues[h.id] !== null && handoverValues[h.id]! > 0)
      .map((h) => ({ fromUid: h.fromUid, toUid: h.toUid, amount: handoverValues[h.id]!, paid: true as const })),
  };
}

/** One valuation pass, with hand-overs arriving at the values found so far (null: not yet known). */
function valueWallets(
  wallets: WalletDoc[],
  topUps: TopUpDoc[],
  cashPayments: ExpenseDoc[],
  handovers: HandoverDoc[],
  arriving: Record<string, number | null>,
) {
  const values: Record<string, number | null> = {};
  const handoverValues: Record<string, number | null> = {};
  const kitties: KittyInfo[] = [];

  const states = wallets.map((wallet): WalletState => {
    const own = topUps.filter((t) => t.walletId === wallet.id);
    const outs = handovers.filter((h) => walletIdFor(h.fromUid, h.currency) === wallet.id);
    const ins = handovers.filter((h) => walletIdFor(h.toUid, h.currency) === wallet.id);
    const inTopUps = ins.flatMap((h) => (arriving[h.id] != null ? [handoverIn(h, wallet.id, arriving[h.id]!)] : []));
    const pool = [...own, ...inTopUps].sort(poolOrder);
    const payments = [
      ...cashPayments.filter((e) => e.paidWith?.kind === 'wallet' && e.paidWith.walletId === wallet.id),
      ...outs.map((h) => handoverOut(h, wallet.id)),
    ].sort(spentOrder);
    const rate = walletRate(pool);
    // Spending before any cash was in the wallet is valued at the cash its owner bought,
    // not at cash handed to them; only cash handed over can value it if none was bought.
    const fallback = walletRate(own) ?? rate;
    const valued: (number | null)[] = rate && fallback ? runningValues(pool, payments, fallback) : payments.map(() => null);
    payments.forEach((e, i) => {
      if (e.id.startsWith(HANDOVER)) handoverValues[e.id.slice(HANDOVER.length)] = valued[i];
      else values[e.id] = valued[i];
    });
    // What's left counts hand-overs; what was bought and spent doesn't, so cash
    // received isn't shown as bought, nor cash handed over as spent.
    const sum = (list: { foreignAmount: number; homeAmount: number }[]) => ({
      foreign: list.reduce((s, t) => s + t.foreignAmount, 0),
      home: list.reduce((s, t) => s + t.homeAmount, 0),
    });
    const inPool = sum(pool);
    const paidIn = sum(own);
    const realPayments = payments.filter((e) => !e.id.startsWith(HANDOVER));
    const spent = realPayments.reduce((s, e) => s + e.total, 0);
    const spentValue = valued.reduce<number>((s, v) => s + (v ?? 0), 0);
    const left = {
      foreign: inPool.foreign - payments.reduce((s, e) => s + e.total, 0),
      home: rate ? inPool.home - spentValue : null,
    };
    const state: WalletState = {
      wallet,
      topUps: [...own].sort((a, b) => a.date.localeCompare(b.date) || addedAt(a) - addedAt(b)),
      rate,
      paidIn,
      spent,
      left,
      leftRate: left.foreign > 0 && left.home !== null && left.home >= 0 ? { foreign: left.foreign, home: left.home } : rate,
      payments: realPayments,
      handedOut: outs.reduce((s, h) => s + h.foreignAmount, 0),
      handedIn: ins.reduce((s, h) => s + h.foreignAmount, 0),
      handovers: [...outs, ...ins].sort((a, b) => a.date.localeCompare(b.date)),
    };
    if (wallet.kind === 'kitty') {
      const contributors = kittyContributors(own, left, wallet.keptBy);
      state.kitty = { contributors };
      kitties.push({
        walletId: wallet.id, currency: wallet.currency, paidIn, left, contributors, beyond: beyondCash(realPayments, paidIn.foreign),
        ...(wallet.keptBy ? { keptBy: wallet.keptBy } : {}),
      });
    }
    return state;
  });

  return { states, values, handoverValues, kitties };
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
