import { deleteField, doc, getDocs, updateDoc, writeBatch, type DocumentReference } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  categoriesCol, expensesCol, groupsCol, handoversCol, invitesCol, itemsCol,
  settlementsCol, suggestionsDocRef, topUpsCol, walletsCol,
} from '../../lib/converters';
import { settleWrite } from '../../lib/settleWrite';
import type { GroupDoc } from '../../types/models';

const SYNC_FAILED = "Couldn't sync a trip change. Check your connection and try again.";
/** Firestore allows 500 writes a batch; this leaves room. */
const BATCH_SIZE = 450;

/**
 * Changes a trip's home currency, with any other settings saved alongside it,
 * and removes its cash wallets in the same batch. Only for a trip with nothing
 * on it yet: every amount on a trip is valued in its home currency, so the
 * caller checks there are no expenses, cash or settle-ups. The wallets are
 * empty then, and one in the new home currency would no longer be foreign.
 */
export function changeTripCurrency(
  tripId: string,
  fields: { name: string; currency: string; trip?: { startDate: string; endDate: string } },
  emptyWalletIds: string[],
): Promise<void> {
  const batch = writeBatch(db);
  for (const id of emptyWalletIds) batch.delete(doc(walletsCol(tripId), id));
  batch.update(doc(groupsCol, tripId), fields);
  return settleWrite(batch.commit(), SYNC_FAILED);
}

/**
 * Deletes a trip for everyone on it: its expenses and their items, cash,
 * hand-overs, settle-ups, invites and categories, then the trip itself, so
 * nothing is left behind if a batch fails part way. A closed trip is reopened
 * first, since the rules keep a closed trip's records from being deleted.
 * Waits for the server, and fails straight away offline.
 */
export async function deleteTrip(trip: Pick<GroupDoc, 'id' | 'tripClosedAt'>): Promise<void> {
  if (navigator.onLine === false) throw new Error('offline');
  const id = trip.id;
  if (trip.tripClosedAt) await updateDoc(doc(groupsCol, id), { tripClosedAt: deleteField() });

  const expenses = await getDocs(expensesCol(id));
  const refs: DocumentReference[] = [];
  for (const items of await Promise.all(expenses.docs.map((e) => getDocs(itemsCol(id, e.id))))) {
    refs.push(...items.docs.map((d) => d.ref));
  }
  refs.push(...expenses.docs.map((d) => d.ref));
  const rest = await Promise.all([
    getDocs(walletsCol(id)), getDocs(topUpsCol(id)), getDocs(handoversCol(id)),
    getDocs(settlementsCol(id)), getDocs(invitesCol(id)), getDocs(categoriesCol(id)),
  ]);
  for (const snap of rest) refs.push(...snap.docs.map((d) => d.ref as DocumentReference));
  refs.push(suggestionsDocRef(id));
  refs.push(doc(groupsCol, id));

  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(i, i + BATCH_SIZE)) batch.delete(ref);
    await batch.commit();
  }
}
