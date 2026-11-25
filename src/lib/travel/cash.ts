import { minorDigits } from './currency';
import { createdMillis, expenseDay } from './tripExpense';
import { valueCash, walletRate, type WalletRate } from './wallet';
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
}

export interface TripCash {
  wallets: WalletState[];
  /** Home value of each cash payment, by expense id; null when its wallet can't value it. */
  values: Record<string, number | null>;
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

export function tripCash(wallets: WalletDoc[], topUps: TopUpDoc[], expenses: ExpenseDoc[]): TripCash {
  const values: Record<string, number | null> = {};
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
    return {
      wallet,
      topUps: own,
      rate,
      paidIn,
      spent,
      left,
      leftRate: left.foreign > 0 && left.home !== null && left.home >= 0 ? { foreign: left.foreign, home: left.home } : rate,
      payments,
    };
  });

  return { wallets: states, values };
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
