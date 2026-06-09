import { useState } from 'react';
import { setDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { settlementsCol } from '../../lib/converters';
import { computeSummary } from '../../lib/settlement';
import { formatMoney } from '../../lib/money';
import { useMonthItems } from '../../hooks/useMonthItems';
import { useSettlements } from '../../hooks/useSettlements';
import { useIncome } from '../../hooks/useIncome';
import type { GroupDoc } from '../../types/models';

interface Props {
  group: GroupDoc;
  currentUserUid: string;
  selectedMonth: string;
}

export default function Summary({ group, currentUserUid, selectedMonth }: Props) {
  const { items, loading: itemsLoading } = useMonthItems(group.id, selectedMonth);
  const { settlements, loading: settlementsLoading } = useSettlements(group.id, selectedMonth);
  const { income, loading: incomeLoading } = useIncome(group.id, selectedMonth);
  const [isPending, setIsPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (itemsLoading || settlementsLoading || incomeLoading) {
    return <div>Loading…</div>;
  }

  const summary = computeSummary(group.memberUids, items, settlements);

  const grandTotal = items.reduce((sum, it) => sum + it.amount, 0);

  const pendingTransactions = summary.transactions;
  const paidSettlements = settlements.filter((s) => s.paid);

  async function markPaid(fromUid: string, toUid: string, amount: number) {
    setActionError(null);
    setIsPending(true);
    try {
      const id = `${selectedMonth}_${fromUid}_${toUid}`;
      await setDoc(doc(settlementsCol(group.id), id), {
        id,
        month: selectedMonth,
        fromUid,
        toUid,
        amount,
        paid: true,
        paidAt: serverTimestamp(),
        markedByUid: currentUserUid,
      });
    } catch {
      setActionError('Failed. Try again.');
    } finally {
      setIsPending(false);
    }
  }

  async function undoSettlement(settlementId: string) {
    setActionError(null);
    setIsPending(true);
    try {
      await deleteDoc(doc(settlementsCol(group.id), settlementId));
    } catch {
      setActionError('Failed. Try again.');
    } finally {
      setIsPending(false);
    }
  }

  function memberName(uid: string): string {
    return group.members[uid]?.displayName ?? uid;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Summary — {selectedMonth}</h1>

      {/* Per-person section */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Per person</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-2 font-medium">Member</th>
                <th className="pb-2 font-medium text-right">Total paid</th>
                <th className="pb-2 font-medium text-right">Equal share</th>
                <th className="pb-2 font-medium text-right">Income</th>
                <th className="pb-2 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {group.memberUids.map((uid) => {
                const memberIncome = income.find((i) => i.uid === uid);
                const balance = summary.balance[uid] ?? 0;
                return (
                  <tr key={uid} className="border-b border-gray-100">
                    <td className="py-2">{memberName(uid)}</td>
                    <td className="py-2 text-right">
                      {formatMoney(summary.paidTotal[uid] ?? 0, group.currency)}
                    </td>
                    <td className="py-2 text-right">
                      {formatMoney(summary.shareOf[uid] ?? 0, group.currency)}
                    </td>
                    <td className="py-2 text-right">
                      {memberIncome ? formatMoney(memberIncome.amount, group.currency) : '—'}
                    </td>
                    <td
                      className={`py-2 text-right font-medium ${
                        balance > 0
                          ? 'text-green-600'
                          : balance < 0
                            ? 'text-red-600'
                            : 'text-gray-600'
                      }`}
                    >
                      {formatMoney(balance, group.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Group totals */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Group totals</h2>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Shared total</span>
            <span className="font-medium">{formatMoney(summary.sharedTotal, group.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Grand total (all items)</span>
            <span className="font-medium">{formatMoney(grandTotal, group.currency)}</span>
          </div>
        </div>
      </section>

      {/* Settle up */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Settle up</h2>
        {pendingTransactions.length === 0 ? (
          <p className="text-sm text-gray-500">All settled!</p>
        ) : (
          <ul className="space-y-2">
            {pendingTransactions.map((txn) => (
              <li
                key={`${txn.fromUid}-${txn.toUid}`}
                className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-4 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{memberName(txn.fromUid)}</span>
                  {' → '}
                  <span className="font-medium">{memberName(txn.toUid)}</span>
                  {': '}
                  {formatMoney(txn.amount, group.currency)}
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void markPaid(txn.fromUid, txn.toUid, txn.amount)}
                  className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Mark paid
                </button>
              </li>
            ))}
          </ul>
        )}
        {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}
      </section>

      {/* Settled */}
      {paidSettlements.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Settled</h2>
          <ul className="space-y-2">
            {paidSettlements.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-sm"
              >
                <span className="text-gray-600">
                  <span className="font-medium">{memberName(s.fromUid)}</span>
                  {' → '}
                  <span className="font-medium">{memberName(s.toUid)}</span>
                  {': '}
                  {formatMoney(s.amount, group.currency)}
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void undoSettlement(s.id)}
                  className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
