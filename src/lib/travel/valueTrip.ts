import { computeSummary, type PaidSettlement, type Summary, type SummaryItem } from '../settlement';
import { formatMinor } from './currency';
import { expenseHomeTotal, isEstimated } from './tripExpense';
import { isKittyId, type KittyInfo } from './cash';
import { signedAmount } from '../refund';

/** A credit that moves value from a person to a kitty's party, applied like a paid settlement. */
export interface KittyCredit { fromUid: string; toUid: string; amount: number; paid: true; }
import { spreadInProportion } from './spread';

export { spreadInProportion };
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
  /** Members, anyone who paid or shares an item and has since left the trip, and any kitty (as its own party). */
  parties: string[];
  /** `parties` without kitties: the people to show. */
  people: string[];
  /** The kitties' credits, applied like paid settlements. */
  credits: KittyCredit[];
  /** Card payments still on an estimated rate. */
  estimated: ExpenseDoc[];
  /** Cash payments that can't be valued yet: their wallet has no cash in it, or is gone. */
  unvalued: ExpenseDoc[];
}

export function valueTrip(
  trip: GroupDoc,
  expenses: ExpenseDoc[],
  itemsByExpense: Record<string, ItemDoc[]>,
  /** Cash payments' home values, from tripCash. */
  cashValues: Record<string, number | null> = {},
  /** The trip's kitties, from tripCash. */
  kitties: KittyInfo[] = [],
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
    const paidWith = expense.paidWith;
    const kittyId = paidWith?.kind === 'wallet' && isKittyId(paidWith.walletId) ? paidWith.walletId : null;
    // Without its kitty's contributions a kitty payment can't be settled, so it waits like any unvalued cash.
    const homeTotal = kittyId && !kitties.some((k) => k.walletId === kittyId) ? null : expenseHomeTotal(expense, home, cashValues);
    if (homeTotal === null) {
      unvalued.push(expense);
      continue;
    }
    if (isEstimated(expense, home)) estimated.push(expense);
    const parts = spreadInProportion(homeTotal, expenseItems.map((it) => it.amount));
    // A kitty payment is paid by the kitty, not by whoever handed the cash over.
    const payer = kittyId ?? expense.payerUid;
    expenseItems.forEach((it, i) => {
      addParty(payer);
      // A shared item without a list (written before T2) is shared by the current members,
      // never by everyone in `parties`, which also holds people who have left.
      // A personal item bought from the kitty is charged to whoever handed the cash over.
      const shared = it.shared || kittyId !== null;
      const sharedWith = it.shared
        ? (it.sharedWith?.length ? it.sharedWith : trip.memberUids)
        : kittyId ? [expense.payerUid] : it.sharedWith;
      for (const uid of sharedWith ?? []) addParty(uid);
      items.push({
        amount: parts[i],
        shared,
        payerUid: payer,
        ...(it.refund ? { refund: true } : {}),
        ...(sharedWith ? { sharedWith } : {}),
        expenseId: expense.id,
        categoryId: it.categoryId,
        category: it.category,
      });
    });
  }
  const credits = kitties.flatMap((k) => kittyCredits(k, items, expenses));
  for (const c of credits) {
    addParty(c.fromUid);
    addParty(c.toUid);
  }
  return { items, parties, people: parties.filter((uid) => !isKittyId(uid)), credits, estimated, unvalued };
}

/**
 * Credits that leave a kitty at exactly zero: its spending, as counted here,
 * is credited to the people who put money in, in proportion to what their
 * cash cost them (so with nothing spent nobody owes anyone, and everyone bears
 * the same share of their own cost). Spending past the cash put in is credited
 * to whoever handed that cash over, in proportion to how far each payment went past it.
 */
function kittyCredits(k: KittyInfo, items: ValuedItem[], expenses: ExpenseDoc[]): KittyCredit[] {
  const spent = items.filter((it) => it.payerUid === k.walletId).reduce((s, it) => s + signedAmount(it), 0);
  if (spent === 0 || k.contributors.length === 0) return [];
  const toContributors = k.left.foreign > 0 ? spent : Math.min(spent, k.paidIn.home);
  const homes = k.contributors.map((c) => c.home);
  const weights = homes.some((h) => h > 0) ? homes : k.contributors.map((c) => c.foreign);
  const parts = spreadInProportion(toContributors, weights);
  const credits: KittyCredit[] = k.contributors
    .map((c, i) => ({ fromUid: c.uid, toUid: k.walletId, amount: parts[i], paid: true as const }))
    .filter((c) => c.amount !== 0);
  const rest = spent - parts.reduce((s, p) => s + p, 0);
  if (rest !== 0) {
    const counted = new Set(items.filter((it) => it.payerUid === k.walletId).map((it) => it.expenseId));
    const payments = expenses.filter((e) => counted.has(e.id));
    const beyond = payments.map((e) => k.beyond[e.id] ?? 0);
    const shares = spreadInProportion(rest, beyond.some((b) => b > 0) ? beyond : payments.map((e) => e.total));
    payments.forEach((e, i) => {
      if (shares[i] !== 0) credits.push({ fromUid: e.payerUid, toUid: k.walletId, amount: shares[i], paid: true });
    });
  }
  return credits;
}

/** Balances and the fewest payments to settle, in home minor units, after any settle-up already paid. */
export function tripSummary(valuation: TripValuation, settlements: PaidSettlement[]): Summary {
  return computeSummary(valuation.parties, valuation.items, [...settlements, ...valuation.credits]);
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
  kitties: KittyInfo[] = [],
): { spent: number; estimated: boolean; balance: ReturnType<typeof tripBalanceCopy> } | null {
  // Nothing to show until something was spent or paid back; a paid settlement alone still leaves a balance.
  if (expenses.length === 0 && !settlements.some((s) => s.paid)) return null;
  const valuation = valueTrip(trip, expenses, itemsByExpense, cashValues, kitties);
  const summary = tripSummary(valuation, settlements);
  return {
    spent: valuation.items.reduce((s, it) => s + it.amount, 0),
    // Cash values move as wallets change, so a total with cash in it is approximate, as in the expense list.
    estimated: valuation.estimated.length > 0 || valuation.items.some((it) => expenses.find((e) => e.id === it.expenseId)?.paidWith?.kind === 'wallet'),
    balance: tripBalanceCopy(summary.balance[viewerUid] ?? 0, true, trip.currency),
  };
}
