import { doc, serverTimestamp, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { expensesCol, itemsCol } from '../../lib/converters';
import { chargedRate, type BuiltTripExpense } from '../../lib/travel/tripExpense';
import { settleWrite } from '../../lib/settleWrite';
import type { ExpenseDoc, ItemDoc, TripPayment } from '../../types/models';

// Trip writes don't wait for the server while offline (travellers often are):
// the local cache has them at once, and a rejection later raises a notice.
const SYNC_FAILED = "Couldn't sync a trip change. Check your connection and try again.";

/** A 'YYYY-MM-DD' day at local noon, so time zones never move it to another day. */
function noon(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

function payment(built: BuiltTripExpense, home: string, existing?: ExpenseDoc): TripPayment {
  if (built.currency.toUpperCase() === home.toUpperCase()) return { kind: 'card', rate: 1, rateStatus: 'actual' };
  const old = existing?.paidWith;
  // What the card was charged still holds while the currency and total are unchanged.
  if (old?.kind === 'card' && old.rateStatus === 'actual' && existing?.currency === built.currency && existing.total === built.total) {
    return old;
  }
  return { kind: 'card', rate: built.rate, rateStatus: 'estimated' };
}

interface SaveArgs {
  tripId: string;
  uid: string;
  home: string;
  built: BuiltTripExpense;
  /** Category names by id, stored on each item as the household does. */
  categories: Record<string, string>;
  existing?: { expense: ExpenseDoc; items: ItemDoc[] };
}

/** Creates or replaces a trip expense and its items in one batch, and returns its id. */
export async function saveTripExpense({ tripId, uid, home, built, categories, existing }: SaveArgs): Promise<string> {
  const batch = writeBatch(db);
  const ref = existing ? doc(expensesCol(tripId), existing.expense.id) : doc(expensesCol(tripId));
  const month = built.date.slice(0, 7);
  batch.set(ref, {
    groupId: tripId,
    date: Timestamp.fromDate(noon(built.date)),
    month,
    shopName: built.shopName,
    payerUid: built.payerUid,
    total: built.total,
    itemCount: built.items.length,
    // The rules bind every write to its author, so an edit records who made it.
    createdByUid: uid,
    createdAt: existing?.expense.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
    currency: built.currency,
    paidWith: payment(built, home, existing?.expense),
    tripDay: built.date,
  } as unknown as ExpenseDoc);
  for (const old of existing?.items ?? []) batch.delete(doc(itemsCol(tripId, ref.id), old.id));
  for (const it of built.items) {
    batch.set(doc(itemsCol(tripId, ref.id)), {
      groupId: tripId,
      expenseId: ref.id,
      month,
      name: it.name,
      categoryId: it.categoryId,
      category: categories[it.categoryId] ?? '',
      amount: it.amount,
      shared: it.shared,
      payerUid: built.payerUid,
      ...(it.sharedWith ? { sharedWith: it.sharedWith } : {}),
    } as ItemDoc);
  }
  await settleWrite(batch.commit(), SYNC_FAILED);
  return ref.id;
}

/** Records what a card payment was actually charged in the home currency, and the rate that implies. */
export function recordCharge(tripId: string, expense: ExpenseDoc, homeTotal: number, home: string, uid: string): Promise<void> {
  const rate = chargedRate(expense.total, expense.currency ?? home, homeTotal, home);
  return settleWrite(
    updateDoc(doc(expensesCol(tripId), expense.id), {
      paidWith: { kind: 'card', rate, rateStatus: 'actual', homeTotal },
      updatedAt: serverTimestamp(),
      createdByUid: uid, // the rules bind every write to its author
    }),
    SYNC_FAILED,
  );
}

export function deleteTripExpense(tripId: string, expenseId: string, itemIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  for (const id of itemIds) batch.delete(doc(itemsCol(tripId, expenseId), id));
  batch.delete(doc(expensesCol(tripId), expenseId));
  return settleWrite(batch.commit(), SYNC_FAILED);
}
