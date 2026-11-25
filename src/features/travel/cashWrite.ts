import { deleteDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { topUpsCol, walletsCol } from '../../lib/converters';
import { settleWrite } from '../../lib/settleWrite';
import { kittyIdFor, walletIdFor } from '../../lib/travel/cash';
import type { TopUpDoc, WalletDoc } from '../../types/models';

const SYNC_FAILED = "Couldn't sync a trip change. Check your connection and try again.";

type AddCashArgs = {
  tripId: string;
  /** Who is recording it (the rules bind each top-up to its author). */
  uid: string;
  currency: string;
  foreignAmount: number;
  homeAmount: number;
  date: string;
  /** Whether the wallet already exists; if not, it's created in the same batch. */
  walletExists: boolean;
} & (
  /** A member's own cash: any trip member, including one without an account. */
  | { kitty?: false; ownerUid: string }
  /** The shared kitty, and who put this money into it. */
  | { kitty: true; fromUid: string }
);

/** Records cash bought for a member's wallet or put into the kitty, creating the wallet the first time. Doesn't wait for the server offline. */
export function addCash(a: AddCashArgs): Promise<void> {
  const batch = writeBatch(db);
  const walletId = a.kitty ? kittyIdFor(a.currency) : walletIdFor(a.ownerUid, a.currency);
  if (!a.walletExists) {
    batch.set(doc(walletsCol(a.tripId), walletId), {
      id: walletId,
      ...(a.kitty ? { kind: 'kitty' } : { kind: 'personal', ownerUid: a.ownerUid }),
      currency: a.currency,
      createdByUid: a.uid,
      createdAt: serverTimestamp(),
    } as unknown as WalletDoc);
  }
  const ref = doc(topUpsCol(a.tripId));
  batch.set(ref, {
    id: ref.id,
    walletId,
    byUid: a.uid,
    ...(a.kitty ? { fromUid: a.fromUid } : {}),
    date: a.date,
    foreignAmount: a.foreignAmount,
    homeAmount: a.homeAmount,
    createdAt: serverTimestamp(),
  } as unknown as TopUpDoc);
  return settleWrite(batch.commit(), SYNC_FAILED);
}

export function deleteTopUp(tripId: string, topUpId: string): Promise<void> {
  return settleWrite(deleteDoc(doc(topUpsCol(tripId), topUpId)), SYNC_FAILED);
}
