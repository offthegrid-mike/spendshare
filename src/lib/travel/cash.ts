import { minorDigits } from './currency';
import { createdMillis, expenseDay } from './tripExpense';
import { valueSpends, walletBalance, walletRate, type WalletRate } from './wallet';
import type { ExpenseDoc, TopUpDoc, WalletDoc } from '../../types/models';

/**
 * Cash wallets (docs/TRAVEL_PLAN.md, T4). Cash bought before or during a trip
 * locks in what it cost; every cash payment is valued at its wallet's weighted
 * average rate. Payments are valued cumulatively in the order they were spent
 * (day, then when added), so a wallet's spending plus what's left always adds
 * up to exactly what was paid for its cash.
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

export function tripCash(wallets: WalletDoc[], topUps: TopUpDoc[], expenses: ExpenseDoc[]): TripCash {
  const values: Record<string, number | null> = {};
  const cashPayments = expenses.filter((e) => e.paidWith?.kind === 'wallet');
  const known = new Set(wallets.map((w) => w.id));
  for (const e of cashPayments) {
    if (e.paidWith?.kind === 'wallet' && !known.has(e.paidWith.walletId)) values[e.id] = null;
  }

  const states = wallets.map((wallet): WalletState => {
    const own = topUps.filter((t) => t.walletId === wallet.id).sort((a, b) => a.date.localeCompare(b.date) || addedAt(a) - addedAt(b));
    const payments = cashPayments
      .filter((e) => e.paidWith?.kind === 'wallet' && e.paidWith.walletId === wallet.id)
      .sort(spentOrder);
    const rate = walletRate(own);
    const spends = payments.map((e) => e.total);
    const valued = rate ? valueSpends(spends, rate) : spends.map(() => null);
    payments.forEach((e, i) => { values[e.id] = valued[i]; });
    return {
      wallet,
      topUps: own,
      rate,
      paidIn: {
        foreign: own.reduce((s, t) => s + t.foreignAmount, 0),
        home: own.reduce((s, t) => s + t.homeAmount, 0),
      },
      spent: spends.reduce((s, x) => s + x, 0),
      left: walletBalance(own, spends),
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
