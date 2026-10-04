import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { settlementsCol } from './converters';
import type { Txn } from './settlement';
import type { SettlementDoc } from '../types/models';

/**
 * Records a settle-up transaction as paid. There is one doc per month and
 * direction, so a second settle-up in the same direction (after more
 * expenses were added) adds to the earlier paid amount instead of replacing
 * it. Callers pass the month's settlements they already have loaded, which
 * also works offline, unlike a transaction.
 */
export function markSettlementPaid(
  gid: string,
  month: string,
  txn: Txn,
  byUid: string,
  monthSettlements: SettlementDoc[] = [],
): Promise<void> {
  const id = `${month}_${txn.fromUid}_${txn.toUid}`;
  const earlier = monthSettlements.find((s) => s.id === id && s.paid)?.amount ?? 0;
  return setDoc(doc(settlementsCol(gid), id), {
    id,
    month,
    fromUid: txn.fromUid,
    toUid: txn.toUid,
    amount: earlier + txn.amount,
    paid: true,
    paidAt: serverTimestamp(),
    markedByUid: byUid,
  });
}

export function undoSettlement(gid: string, settlementId: string): Promise<void> {
  return deleteDoc(doc(settlementsCol(gid), settlementId));
}
