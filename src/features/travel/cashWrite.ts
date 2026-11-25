import { deleteDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { topUpsCol, walletsCol } from '../../lib/converters';
import { settleWrite } from '../../lib/settleWrite';
import { walletIdFor } from '../../lib/travel/cash';
import type { TopUpDoc, WalletDoc } from '../../types/models';

const SYNC_FAILED = "Couldn't sync a trip change. Check your connection and try again.";

interface AddCashArgs {
  tripId: string;
  /** Who is recording it (the rules bind each top-up to its author). */
  uid: string;
  /** Whose wallet: any trip member, including one without an account. */
  ownerUid: string;
  currency: string;
  foreignAmount: number;
  homeAmount: number;
  date: string;
  /** Whether the owner already has a wallet in this currency; if not, it's created in the same batch. */
  walletExists: boolean;
}

/** Records cash bought for a wallet, creating the wallet the first time. Doesn't wait for the server offline. */
export function addCash(a: AddCashArgs): Promise<void> {
  const batch = writeBatch(db);
  const walletId = walletIdFor(a.ownerUid, a.currency);
  if (!a.walletExists) {
    batch.set(doc(walletsCol(a.tripId), walletId), {
      id: walletId, kind: 'personal', ownerUid: a.ownerUid, currency: a.currency, createdByUid: a.uid, createdAt: serverTimestamp(),
    } as unknown as WalletDoc);
  }
  const ref = doc(topUpsCol(a.tripId));
  batch.set(ref, {
    id: ref.id, walletId, byUid: a.uid, date: a.date, foreignAmount: a.foreignAmount, homeAmount: a.homeAmount, createdAt: serverTimestamp(),
  } as unknown as TopUpDoc);
  return settleWrite(batch.commit(), SYNC_FAILED);
}

export function deleteTopUp(tripId: string, topUpId: string): Promise<void> {
  return settleWrite(deleteDoc(doc(topUpsCol(tripId), topUpId)), SYNC_FAILED);
}
