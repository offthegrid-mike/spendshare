import { distributeEvenly } from './money';
import { signedAmount } from './refund';

export interface SummaryItem {
  amount: number; shared: boolean; payerUid: string; refund?: boolean;
  /** Who shares a shared item; missing or empty means every member (households never set it). */
  sharedWith?: string[];
}
export interface PaidSettlement { fromUid: string; toUid: string; amount: number; paid: boolean; }
export interface Txn { fromUid: string; toUid: string; amount: number; }
export interface Summary {
  paidTotal: Record<string, number>; sharedTotal: number;
  /** Shared spending per payer, the input to the balance tug bar. */
  paidShared: Record<string, number>;
  shareOf: Record<string, number>; balance: Record<string, number>; transactions: Txn[];
}

export function computeSummary(members: string[], items: SummaryItem[], settlements: PaidSettlement[]): Summary {
  const paidTotal: Record<string, number> = {}; const paidShared: Record<string, number> = {};
  for (const m of members) { paidTotal[m] = 0; paidShared[m] = 0; }
  let sharedTotal = 0;
  // Shared spending per set of sharers, keyed by the set's sorted uids ('' = every member).
  // Each set is split once, so rounding costs at most one minor unit per set.
  const bySet = new Map<string, { uids: string[]; total: number }>();
  const everyoneKey = [...new Set(members)].sort().join('\u0000');
  for (const it of items) {
    if (paidTotal[it.payerUid] === undefined) { paidTotal[it.payerUid] = 0; paidShared[it.payerUid] = 0; }
    // A refund is money back to its payer, so it comes off what they paid.
    const amount = signedAmount(it);
    paidTotal[it.payerUid] += amount;
    if (it.shared) {
      sharedTotal += amount; paidShared[it.payerUid] += amount;
      const chosen = it.sharedWith?.length ? [...new Set(it.sharedWith)].sort() : null;
      // Choosing every member is the same set as choosing nobody, so it rounds as one.
      const key = chosen && chosen.join('\u0000') !== everyoneKey ? chosen.join('\u0000') : '';
      const set = bySet.get(key) ?? { uids: key ? chosen! : members, total: 0 };
      set.total += amount;
      bySet.set(key, set);
    }
  }
  // A sharer who is no longer a member still gets a share, so their debt doesn't vanish.
  const parties = [...members];
  const shareOf: Record<string, number> = {};
  for (const m of members) shareOf[m] = 0;
  for (const { uids, total } of bySet.values()) {
    for (const [uid, share] of Object.entries(distributeEvenly(total, uids))) {
      if (shareOf[uid] === undefined) { shareOf[uid] = 0; parties.push(uid); }
      shareOf[uid] += share;
    }
  }
  const balance: Record<string, number> = {};
  for (const m of parties) balance[m] = (paidShared[m] ?? 0) - (shareOf[m] ?? 0);
  for (const s of settlements) {
    if (!s.paid) continue;
    balance[s.fromUid] = (balance[s.fromUid] ?? 0) + s.amount;
    balance[s.toUid] = (balance[s.toUid] ?? 0) - s.amount;
  }
  const debtors = parties.filter((m) => balance[m] < 0).map((m) => ({ uid: m, amt: -balance[m] }));
  const creditors = parties.filter((m) => balance[m] > 0).map((m) => ({ uid: m, amt: balance[m] }));
  debtors.sort((a, b) => b.amt - a.amt); creditors.sort((a, b) => b.amt - a.amt);
  const transactions: Txn[] = []; let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    if (pay > 0) transactions.push({ fromUid: debtors[i].uid, toUid: creditors[j].uid, amount: pay });
    debtors[i].amt -= pay; creditors[j].amt -= pay;
    if (debtors[i].amt === 0) i++; if (creditors[j].amt === 0) j++;
  }
  return { paidTotal, sharedTotal, paidShared, shareOf, balance, transactions };
}
