import { format, parseISO } from 'date-fns';
import { minorDigits, toMinor } from './currency';
import { tripProgress } from './trips';
import type { ExpenseDoc, TripDates } from '../../types/models';

/**
 * Trip expenses keep their amounts in the currency they were paid in. A card
 * payment carries its rate as "1 home = rate foreign" (how exchange boards
 * show it: 1 A$ = ¥99), estimated until the amount actually charged is entered.
 */

/** A typed rate. A lone comma is a decimal comma ("98,5", "0,615") unless three digits follow a non-zero number ("16,000"). */
export function parseRate(text: string): number {
  const s = text.replace(/\s/g, '');
  if (!s) return NaN;
  const loneComma = s.includes(',') && !s.includes('.');
  const thousands = /^[1-9]\d{0,2}(,\d{3})+$/.test(s);
  const normal = loneComma && !thousands ? s.replace(',', '.') : s.replace(/,/g, '');
  const n = Number(normal);
  return Number.isFinite(n) ? n : NaN;
}

/** Foreign minor units in home minor units at "1 home = rate foreign". */
export function toHome(amount: number, currency: string, home: string, rate: number): number {
  if (currency.toUpperCase() === home.toUpperCase()) return amount;
  const foreignMajor = amount / 10 ** minorDigits(currency);
  return Math.round((foreignMajor / rate) * 10 ** minorDigits(home)) + 0;
}

/** The rate implied by what the card was actually charged: foreign per one home. */
export function chargedRate(foreignAmount: number, currency: string, homeAmount: number, home: string): number {
  const foreignMajor = foreignAmount / 10 ** minorDigits(currency);
  const homeMajor = homeAmount / 10 ** minorDigits(home);
  return foreignMajor / homeMajor;
}

export interface TripItemDraft {
  name: string;
  categoryId: string;
  amount: string;
  shared: boolean;
  /** Who shares it, kept even while the item is personal so ticking Shared again restores it. */
  sharedWith: string[];
}

export interface TripExpenseDraft {
  date: string; // 'YYYY-MM-DD'
  shopName: string;
  payerUid: string;
  currency: string;
  rate: string;
  items: TripItemDraft[];
}

export interface BuiltTripItem {
  name: string;
  categoryId: string;
  amount: number;
  shared: boolean;
  sharedWith?: string[];
}

export interface BuiltTripExpense {
  date: string;
  shopName: string;
  payerUid: string;
  currency: string;
  /** 1 in the home currency. */
  rate: number;
  total: number;
  items: BuiltTripItem[];
}

export type BuildResult = { ok: true; value: BuiltTripExpense } | { ok: false; error: string };

const isBlank = (it: TripItemDraft) => !it.name.trim() && !it.amount.trim();

/**
 * Checks a trip expense form and turns it into amounts in its currency's minor
 * units. Blank rows are skipped. A shared item always lists its sharers, so
 * someone who joins the trip later isn't added to what was already split.
 */
export function buildTripExpense(
  draft: TripExpenseDraft,
  home: string,
  { categoryRequired = true }: { categoryRequired?: boolean } = {},
): BuildResult {
  if (!draft.date) return { ok: false, error: 'Choose the date.' };
  if (!draft.payerUid) return { ok: false, error: 'Choose who paid.' };
  const inHome = draft.currency.toUpperCase() === home.toUpperCase();
  const rate = inHome ? 1 : parseRate(draft.rate);
  if (!(rate > 0)) return { ok: false, error: 'Enter the exchange rate.' };

  const rows = draft.items.filter((it) => !isBlank(it));
  if (rows.length === 0) return { ok: false, error: 'Add at least one item.' };

  const items: BuiltTripItem[] = [];
  for (const [i, it] of rows.entries()) {
    const n = i + 1;
    if (!it.name.trim()) return { ok: false, error: `Item ${n}: enter a name.` };
    const amount = toMinor(it.amount, draft.currency);
    if (!(amount > 0)) return { ok: false, error: `Item ${n}: enter an amount.` };
    // A trip whose categories have all been archived can still record what was spent.
    if (!it.categoryId && categoryRequired) return { ok: false, error: `Item ${n}: choose a category.` };
    const sharers = [...new Set(it.sharedWith)];
    if (it.shared && sharers.length === 0) return { ok: false, error: `Item ${n}: choose who shares it.` };
    items.push({
      name: it.name.trim(),
      categoryId: it.categoryId,
      amount,
      shared: it.shared,
      ...(it.shared ? { sharedWith: sharers } : {}),
    });
  }

  return {
    ok: true,
    value: {
      date: draft.date,
      shopName: draft.shopName.trim(),
      payerUid: draft.payerUid,
      currency: draft.currency,
      rate,
      total: items.reduce((s, it) => s + it.amount, 0),
      items,
    },
  };
}

type Priced = Pick<ExpenseDoc, 'total' | 'currency' | 'paidWith'>;

/** The expense in home minor units: what the card was charged, or an estimate at its rate. Null for a wallet payment (valued in T4). */
export function expenseHomeTotal(expense: Priced, home: string): number | null {
  const currency = expense.currency ?? home;
  const paid = expense.paidWith;
  if (paid?.kind === 'wallet') return null;
  if (currency.toUpperCase() === home.toUpperCase() || !paid) return expense.total;
  return paid.homeTotal ?? toHome(expense.total, currency, home, paid.rate);
}

/** A foreign card payment whose amount charged hasn't been entered yet. */
export function isEstimated(expense: Priced, home: string): boolean {
  const currency = expense.currency ?? home;
  return currency.toUpperCase() !== home.toUpperCase()
    && expense.paidWith?.kind === 'card'
    && expense.paidWith.rateStatus === 'estimated';
}

/** The expense's day as the payer chose it; older expenses fall back to the timestamp's local day. */
export function expenseDay(expense: Pick<ExpenseDoc, 'date' | 'tripDay'>): string {
  return expense.tripDay ?? format(expense.date.toDate(), 'yyyy-MM-dd');
}

export interface TripDay { date: string; label: string; expenses: ExpenseDoc[]; }

/** Expenses by day, newest day first, each labelled "Day 3 · Wed 12 May" (or before/after the trip). */
export function tripDayGroups(expenses: ExpenseDoc[], trip: TripDates): TripDay[] {
  const byDay = new Map<string, ExpenseDoc[]>();
  for (const e of expenses) {
    const day = expenseDay(e);
    byDay.set(day, [...(byDay.get(day) ?? []), e]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => {
      const when = format(parseISO(date), 'EEE d MMM');
      const p = tripProgress(trip, date);
      const prefix = p.status === 'current' ? `Day ${p.day}` : p.status === 'upcoming' ? 'Before the trip' : 'After the trip';
      return { date, label: `${prefix} · ${when}`, expenses: list };
    });
}

function createdMillis(e: ExpenseDoc): number {
  // A write still waiting for the server has no createdAt yet: it is the newest.
  const ts = e.createdAt as { toMillis?: () => number } | null;
  return ts?.toMillis ? ts.toMillis() : Number.POSITIVE_INFINITY;
}

/** The currency of the latest expense (else home) and the latest card rate for each foreign currency, to prefill a new expense. */
export function lastRates(expenses: ExpenseDoc[], home: string): { currency: string; rates: Record<string, number> } {
  const newest = [...expenses].sort((a, b) => createdMillis(b) - createdMillis(a));
  const rates: Record<string, number> = {};
  for (const e of newest) {
    const currency = e.currency ?? home;
    if (currency !== home && e.paidWith?.kind === 'card' && rates[currency] === undefined) rates[currency] = e.paidWith.rate;
  }
  return { currency: newest[0]?.currency ?? home, rates };
}
