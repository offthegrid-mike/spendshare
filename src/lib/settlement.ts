import { distributeEvenly } from './money';

export interface SummaryItem { amount: number; shared: boolean; payerUid: string; }
export interface PaidSettlement { fromUid: string; toUid: string; amount: number; paid: boolean; }
export interface Txn { fromUid: string; toUid: string; amount: number; }
export interface Summary {
  paidTotal: Record<string, number>; sharedTotal: number;
  shareOf: Record<string, number>; balance: Record<string, number>; transactions: Txn[];
}

export function computeSummary(members: string[], items: SummaryItem[], settlements: PaidSettlement[]): Summary {
  const paidTotal: Record<string, number> = {}; const paidShared: Record<string, number> = {};
  for (const m of members) { paidTotal[m] = 0; paidShared[m] = 0; }
  let sharedTotal = 0;
  for (const it of items) {
    if (paidTotal[it.payerUid] === undefined) { paidTotal[it.payerUid] = 0; paidShared[it.payerUid] = 0; }
    paidTotal[it.payerUid] += Math.round(it.amount);
    if (it.shared) { sharedTotal += Math.round(it.amount); paidShared[it.payerUid] += Math.round(it.amount); }
  }
  const shareOf = distributeEvenly(sharedTotal, members);
  const balance: Record<string, number> = {};
  for (const m of members) balance[m] = (paidShared[m] ?? 0) - (shareOf[m] ?? 0);
  for (const s of settlements) {
    if (!s.paid) continue;
    balance[s.fromUid] = (balance[s.fromUid] ?? 0) + s.amount;
    balance[s.toUid] = (balance[s.toUid] ?? 0) - s.amount;
  }
  const debtors = members.filter((m) => balance[m] < 0).map((m) => ({ uid: m, amt: -balance[m] }));
  const creditors = members.filter((m) => balance[m] > 0).map((m) => ({ uid: m, amt: balance[m] }));
  debtors.sort((a, b) => b.amt - a.amt); creditors.sort((a, b) => b.amt - a.amt);
  const transactions: Txn[] = []; let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    if (pay > 0) transactions.push({ fromUid: debtors[i].uid, toUid: creditors[j].uid, amount: pay });
    debtors[i].amt -= pay; creditors[j].amt -= pay;
    if (debtors[i].amt === 0) i++; if (creditors[j].amt === 0) j++;
  }
  return { paidTotal, sharedTotal, shareOf, balance, transactions };
}
