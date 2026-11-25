import { deleteDoc, deleteField, doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handoversCol, topUpsCol, walletsCol } from '../../lib/converters';
import { settleWrite } from '../../lib/settleWrite';
import { kittyIdFor, walletIdFor } from '../../lib/travel/cash';
import type { HandoverDoc, TopUpDoc, WalletDoc } from '../../types/models';

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

interface HandOverArgs {
  tripId: string;
  /** Who is recording it (the rules bind each hand-over to its author). */
  uid: string;
  fromUid: string;
  toUid: string;
  currency: string;
  foreignAmount: number;
  date: string;
  /** Whether the receiver already has cash in this currency; if not, their wallet is created in the same batch. */
  receiverHasWallet: boolean;
}

/** Records foreign cash handed from one member to another to settle up. Doesn't wait for the server offline. */
export function handOverCash(a: HandOverArgs): Promise<void> {
  const batch = writeBatch(db);
  if (!a.receiverHasWallet) {
    const walletId = walletIdFor(a.toUid, a.currency);
    batch.set(doc(walletsCol(a.tripId), walletId), {
      id: walletId, kind: 'personal', ownerUid: a.toUid, currency: a.currency, createdByUid: a.uid, createdAt: serverTimestamp(),
    } as unknown as WalletDoc);
  }
  const ref = doc(handoversCol(a.tripId));
  batch.set(ref, {
    id: ref.id, fromUid: a.fromUid, toUid: a.toUid, currency: a.currency, foreignAmount: a.foreignAmount,
    date: a.date, byUid: a.uid, createdAt: serverTimestamp(),
  } as unknown as HandoverDoc);
  return settleWrite(batch.commit(), SYNC_FAILED);
}

/**
 * Undoes a hand-over. `emptyWalletId` is the receiver's wallet when this
 * hand-over started it and nothing else is in it, so it goes too.
 */
export function undoHandover(tripId: string, handoverId: string, emptyWalletId?: string): Promise<void> {
  if (!emptyWalletId) return settleWrite(deleteDoc(doc(handoversCol(tripId), handoverId)), SYNC_FAILED);
  const batch = writeBatch(db);
  batch.delete(doc(handoversCol(tripId), handoverId));
  batch.delete(doc(walletsCol(tripId), emptyWalletId));
  return settleWrite(batch.commit(), SYNC_FAILED);
}

/** One member keeps the kitty's leftover cash, or (null) it's handed back by what each put in. */
export function setKittyKeeper(tripId: string, walletId: string, uid: string | null): Promise<void> {
  return settleWrite(updateDoc(doc(walletsCol(tripId), walletId), { keptBy: uid ?? deleteField() }), SYNC_FAILED);
}
