import { computeSummary, type PaidSettlement, type Summary, type SummaryItem } from '../settlement';
import { formatMinor } from './currency';
import { expenseHomeTotal, isEstimated } from './tripExpense';
import type { ExpenseDoc, GroupDoc, ItemDoc } from '../../types/models';

/**
 * Turns a trip's expenses, each in its own currency, into items in the trip's
 * home currency for computeSummary. A card payment's home value (what it was
 * charged, else its estimate) is spread over its items in proportion to their
 * amounts, so the items always add up to it exactly.
 */

/** Settle-up for a whole trip is stored under this "month", one doc per direction (trip_from_to). */
export const TRIP_SETTLEMENT_MONTH = 'trip';

export interface ValuedItem extends SummaryItem {
  expenseId: string;
  categoryId: string;
  category: string;
}

export interface TripValuation {
  items: ValuedItem[];
  /** Members, plus anyone who paid or shares an item and has since left the trip. */
  parties: string[];
  /** Card payments still on an estimated rate. */
  estimated: ExpenseDoc[];
  /** Cash payments that can't be valued yet: their wallet has no cash in it, or is gone. */
  unvalued: ExpenseDoc[];
}

/** `total` split in proportion to `amounts`, rounded so the parts add up to it; ties go to the earlier part. */
export function spreadInProportion(total: number, amounts: number[]): number[] {
  const sum = amounts.reduce((s, a) => s + a, 0);
  if (sum <= 0) return amounts.map(() => 0);
  const exact = amounts.map((a) => (total * a) / sum);
  const parts = exact.map(Math.floor);
  let left = total - parts.reduce((s, p) => s + p, 0);
  const byFraction = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of byFraction) {
    if (left <= 0) break;
    parts[i] += 1;
    left -= 1;
  }
  return parts;
}

export function valueTrip(
  trip: GroupDoc,
  expenses: ExpenseDoc[],
  itemsByExpense: Record<string, ItemDoc[]>,
  /** Cash payments' home values, from tripCash. */
  cashValues: Record<string, number | null> = {},
): TripValuation {
  const home = trip.currency;
  const items: ValuedItem[] = [];
  const estimated: ExpenseDoc[] = [];
  const unvalued: ExpenseDoc[] = [];
  const parties = [...trip.memberUids];
  const addParty = (uid: string) => {
    if (!parties.includes(uid)) parties.push(uid);
  };

  for (const expense of expenses) {
    const expenseItems = itemsByExpense[expense.id];
    if (!expenseItems || expenseItems.length === 0) continue;
    const homeTotal = expenseHomeTotal(expense, home, cashValues);
    if (homeTotal === null) {
      unvalued.push(expense);
      continue;
    }
    if (isEstimated(expense, home)) estimated.push(expense);
    const parts = spreadInProportion(homeTotal, expenseItems.map((it) => it.amount));
    expenseItems.forEach((it, i) => {
      addParty(expense.payerUid);
      // A shared item without a list (written before T2) is shared by the current members,
      // never by everyone in `parties`, which also holds people who have left.
      const sharedWith = it.shared ? (it.sharedWith?.length ? it.sharedWith : trip.memberUids) : it.sharedWith;
      for (const uid of sharedWith ?? []) addParty(uid);
      items.push({
        amount: parts[i],
        shared: it.shared,
        payerUid: expense.payerUid,
        ...(it.refund ? { refund: true } : {}),
        ...(sharedWith ? { sharedWith } : {}),
        expenseId: expense.id,
        categoryId: it.categoryId,
        category: it.category,
      });
    });
  }
  return { items, parties, estimated, unvalued };
}

/** Balances and the fewest payments to settle, in home minor units, after any settle-up already paid. */
export function tripSummary(valuation: TripValuation, settlements: PaidSettlement[]): Summary {
  return computeSummary(valuation.parties, valuation.items, settlements);
}

export interface TripBreakdown {
  /** Everything spent, shared and personal, in home minor units. */
  spent: number;
  byCategory: { name: string; amount: number }[];
  /** What was paid in each currency, in that currency's minor units, in the order first used. */
  byCurrency: { currency: string; amount: number }[];
}

/**
 * `categoryNames` (current names by id) groups a renamed category as one; without
 * it, or for a deleted category, the name stored on the item is used.
 */
export function tripBreakdown(
  valuation: TripValuation,
  expenses: ExpenseDoc[],
  home: string,
  categoryNames: Record<string, string> = {},
): TripBreakdown {
  const byCategory = new Map<string, { name: string; amount: number }>();
  for (const it of valuation.items) {
    const key = it.categoryId || `name:${it.category}`;
    const name = categoryNames[it.categoryId] || it.category || 'Uncategorised';
    const entry = byCategory.get(key) ?? { name, amount: 0 };
    entry.amount += it.amount;
    byCategory.set(key, entry);
  }
  const byCurrency = new Map<string, number>();
  for (const e of expenses) {
    const currency = e.currency ?? home;
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + e.total);
  }
  return {
    spent: valuation.items.reduce((s, it) => s + it.amount, 0),
    byCategory: [...byCategory.values()].sort((a, b) => b.amount - a.amount),
    byCurrency: [...byCurrency.entries()].map(([currency, amount]) => ({ currency, amount })),
  };
}

/** "You", the member's name, or "A former member" for someone whose name left with them. */
export function tripMemberName(trip: GroupDoc, uid: string, viewerUid: string): string {
  if (uid === viewerUid) return 'You';
  const m = trip.members[uid];
  return m ? m.displayName || m.email || 'A member' : 'A former member';
}

export type BalanceTone = 'owed' | 'owe' | 'settled';

/** "Gets back A$75.76", "You owe ¥500" or "Settled", formatted in the home currency's own decimals. */
export function tripBalanceCopy(balance: number, isViewer: boolean, currency: string): { verb: string; amount: string; tone: BalanceTone } {
  if (balance === 0) return { verb: 'Settled', amount: '', tone: 'settled' };
  const amount = formatMinor(Math.abs(balance), currency);
  if (balance > 0) return { verb: isViewer ? 'You get back' : 'Gets back', amount, tone: 'owed' };
  return { verb: isViewer ? 'You owe' : 'Owes', amount, tone: 'owe' };
}

/** What the trip page and Home tile show: spent so far, and the viewer's balance in words; null with nothing spent or paid. */
export function viewerTripFigures(
  trip: GroupDoc,
  viewerUid: string,
  expenses: ExpenseDoc[],
  itemsByExpense: Record<string, ItemDoc[]>,
  settlements: PaidSettlement[],
  cashValues: Record<string, number | null> = {},
): { spent: number; estimated: boolean; balance: ReturnType<typeof tripBalanceCopy> } | null {
  // Nothing to show until something was spent or paid back; a paid settlement alone still leaves a balance.
  if (expenses.length === 0 && !settlements.some((s) => s.paid)) return null;
  const valuation = valueTrip(trip, expenses, itemsByExpense, cashValues);
  const summary = tripSummary(valuation, settlements);
  return {
    spent: valuation.items.reduce((s, it) => s + it.amount, 0),
    // Cash values move as wallets change, so a total with cash in it is approximate, as in the expense list.
    estimated: valuation.estimated.length > 0 || valuation.items.some((it) => expenses.find((e) => e.id === it.expenseId)?.paidWith?.kind === 'wallet'),
    balance: tripBalanceCopy(summary.balance[viewerUid] ?? 0, true, trip.currency),
  };
}
