import { lazy, Suspense, useState } from 'react';
import { markSettlementPaid, undoSettlement as removeSettlement } from '../../lib/settle';
import { computeSummary } from '../../lib/settlement';
import { formatMoney } from '../../lib/money';
import { useMonthItems } from '../../hooks/useMonthItems';
import { useSettlements } from '../../hooks/useSettlements';
import { useIncome } from '../../hooks/useIncome';
import { useUIStore } from '../../stores/uiStore';
import type { GroupDoc } from '../../types/models';

// Lazy so the Recharts bundle only loads when the Year view is opened.
const YearSummary = lazy(() => import('./YearSummary'));

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
  // The Year view belongs to the month it was opened from: picking another
  // month (rail, month control) drops back to the Month view. Derived, so no
  // effect is needed to reset it.
  const [yearViewMonth, setYearViewMonth] = useState<string | null>(null);
  const view: 'month' | 'year' = yearViewMonth === selectedMonth ? 'year' : 'month';
  const setView = (v: 'month' | 'year') => setYearViewMonth(v === 'year' ? selectedMonth : null);
  const { setMonth } = useUIStore();
  const year = selectedMonth.slice(0, 4);

  function selectMonth(month: string) {
    setMonth(month);
    setView('month');
  }

  const header = (
    <div className="flex items-center justify-between gap-3">
      <h1 className="hidden text-2xl font-extrabold tracking-tight text-slate-900 sm:block">
        Summary — {view === 'year' ? year : selectedMonth}
      </h1>
      <div role="group" aria-label="Summary period" className="inline-flex rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        {(['month', 'year'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={`rounded-lg px-4 py-1.5 transition ${
              view === v ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {v === 'month' ? 'Month' : 'Year'}
          </button>
        ))}
      </div>
    </div>
  );

  if (view === 'year') {
    return (
      <div className="space-y-6">
        {header}
        <Suspense fallback={<div>Loading…</div>}>
          <YearSummary group={group} year={year} onSelectMonth={selectMonth} />
        </Suspense>
      </div>
    );
  }

  // Month-only data gates only the Month view, so the Year view and the toggle
  // stay put while month subscriptions reload.
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
      await markSettlementPaid(group.id, selectedMonth, { fromUid, toUid, amount }, currentUserUid, settlements);
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
      await removeSettlement(group.id, settlementId);
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
    <div className="space-y-6">
      {header}

      {/* Per-person section */}
      <section className="card overflow-hidden p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Per person</h2>

        {/* Mobile: stacked balance cards (hidden on sm+) */}
        <div className="space-y-3 sm:hidden">
          {group.memberUids.map((uid) => {
            const memberIncomeTotal = income
              .filter((i) => i.uid === uid)
              .reduce((sum, i) => sum + i.amount, 0);
            const balance = summary.balance[uid] ?? 0;
            const isPositive = balance > 0;
            const isNegative = balance < 0;
            return (
              <div
                key={uid}
                data-testid="balance-card"
                className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <p className="mb-1 font-semibold text-slate-900">{memberName(uid)}</p>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Paid {formatMoney(summary.paidTotal[uid] ?? 0, group.currency)}</span>
                  <span>Share {formatMoney(summary.shareOf[uid] ?? 0, group.currency)}</span>
                  {memberIncomeTotal > 0 && (
                    <span>Income {formatMoney(memberIncomeTotal, group.currency)}</span>
                  )}
                </div>
                <p
                  className={`mt-1 text-sm font-bold tabular-nums ${
                    isPositive
                      ? 'text-brand-700'
                      : isNegative
                        ? 'text-rose-600'
                        : 'text-slate-500'
                  }`}
                >
                  {isPositive
                    ? `+${formatMoney(balance, group.currency)} owed to you`
                    : isNegative
                      ? `${formatMoney(balance, group.currency)} owes you`
                      : 'Settled'}
                </p>
              </div>
            );
          })}
        </div>

        {/* Desktop: table (hidden on mobile) */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2 font-semibold">Member</th>
                <th className="pb-2 font-semibold text-right">Total paid</th>
                <th className="pb-2 font-semibold text-right">Equal share</th>
                <th className="pb-2 font-semibold text-right">Income</th>
                <th className="pb-2 font-semibold text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {group.memberUids.map((uid) => {
                const memberIncomeTotal = income
                  .filter((i) => i.uid === uid)
                  .reduce((sum, i) => sum + i.amount, 0);
                const balance = summary.balance[uid] ?? 0;
                return (
                  <tr key={uid} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 font-medium text-slate-800">{memberName(uid)}</td>
                    <td className="py-2.5 text-right tabular-nums text-slate-600">
                      {formatMoney(summary.paidTotal[uid] ?? 0, group.currency)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-slate-600">
                      {formatMoney(summary.shareOf[uid] ?? 0, group.currency)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-slate-600">
                      {memberIncomeTotal > 0 ? formatMoney(memberIncomeTotal, group.currency) : '—'}
                    </td>
                    <td className="py-2.5 text-right">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ${
                          balance > 0
                            ? 'bg-brand-50 text-brand-700'
                            : balance < 0
                              ? 'bg-rose-50 text-rose-600'
                              : 'text-slate-500'
                        }`}
                      >
                        {formatMoney(balance, group.currency)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Group totals */}
      <section className="card p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Group totals</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Shared total</span>
            <span className="font-semibold tabular-nums text-slate-900">{formatMoney(summary.sharedTotal, group.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Grand total (all items)</span>
            <span className="font-semibold tabular-nums text-slate-900">{formatMoney(grandTotal, group.currency)}</span>
          </div>
        </div>
      </section>

      {/* Settle up */}
      <section className="card p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Settle up</h2>
        {pendingTransactions.length === 0 ? (
          <p className="flex items-center gap-2 text-sm font-medium text-brand-700">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-100 text-brand-600">✓</span>
            All settled!
          </p>
        ) : (
          <ul className="space-y-2">
            {pendingTransactions.map((txn) => (
              <li
                key={`${txn.fromUid}-${txn.toUid}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
              >
                <span className="text-slate-700">
                  <span className="font-semibold text-slate-900">{memberName(txn.fromUid)}</span>
                  <span className="mx-1.5 text-slate-400">→</span>
                  <span className="font-semibold text-slate-900">{memberName(txn.toUid)}</span>
                  <span className="ml-2 font-semibold tabular-nums text-slate-900">{formatMoney(txn.amount, group.currency)}</span>
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void markPaid(txn.fromUid, txn.toUid, txn.amount)}
                  className="rounded-lg bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50"
                >
                  Mark paid
                </button>
              </li>
            ))}
          </ul>
        )}
        {actionError && <p className="mt-2 text-sm text-rose-600">{actionError}</p>}
      </section>

      {/* Settled */}
      {paidSettlements.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Settled</h2>
          <ul className="space-y-2">
            {paidSettlements.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm"
              >
                <span className="text-slate-500 line-through decoration-slate-300">
                  <span className="font-medium text-slate-600">{memberName(s.fromUid)}</span>
                  <span className="mx-1.5">→</span>
                  <span className="font-medium text-slate-600">{memberName(s.toUid)}</span>
                  <span className="ml-2 tabular-nums">{formatMoney(s.amount, group.currency)}</span>
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void undoSettlement(s.id)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
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
