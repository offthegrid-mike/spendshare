import { lazy, Suspense, useState } from 'react';
import { format } from 'date-fns';
import { CircleCheck } from 'lucide-react';
import { markSettlementPaid, undoSettlement as removeSettlement } from '../../lib/settle';
import { computeSummary } from '../../lib/settlement';
import { formatMoney } from '../../lib/money';
import { computeMonthBreakdown } from '../../lib/monthSummary';
import { comparablePrevDays, comparisonLabel, daysElapsedInMonth, formatMonthLabel, prevMonthKey } from '../../lib/month';
import { memberBalanceCopy, memberName } from '../../lib/balance';
import { useMonthExpenses } from '../../hooks/useMonthExpenses';
import { useSettlements } from '../../hooks/useSettlements';
import { useIncome } from '../../hooks/useIncome';
import { useUIStore } from '../../stores/uiStore';
import Avatar from '../../components/ui/Avatar';
import SegmentedControl from '../../components/ui/SegmentedControl';
import { RouteSkeleton } from '../../components/AppSkeletons';
import MonthOverview from './MonthOverview';
import CategoryBreakdown from './CategoryBreakdown';
import TopShops from './TopShops';
import type { GroupDoc } from '../../types/models';

// Lazy so the Recharts bundle only loads when the Year view is opened.
const YearSummary = lazy(() => import('./YearSummary'));

interface Props {
  group: GroupDoc;
  currentUserUid: string;
  selectedMonth: string;
}

const TONE = { owed: 'text-accent-ink', owe: 'text-negative', settled: 'text-ink-muted' } as const;

/** "Gets back A$88.29": words in the UI font, the amount in mono. */
function BalanceCopy({ copy }: { copy: ReturnType<typeof memberBalanceCopy> }) {
  return (
    <span className={`font-semibold ${TONE[copy.tone]}`}>
      {copy.verb}
      {copy.amount && <> <span className="money">{copy.amount}</span></>}
    </span>
  );
}
const PERIODS = [
  { value: 'month' as const, label: 'Month' },
  { value: 'year' as const, label: 'Year' },
];

export default function Summary({ group, currentUserUid, selectedMonth }: Props) {
  const { expenses, itemsByExpense, loading: expensesLoading, itemsLoading } = useMonthExpenses(group.id, selectedMonth);
  // The month before, to compare against. It never gates the page: the
  // comparison just appears once it has loaded. Its expenses are needed too,
  // for their dates, so a month in progress is set beside the same days of it.
  const prevMonth = prevMonthKey(selectedMonth);
  const prev = useMonthExpenses(group.id, prevMonth);
  const prevLoading = prev.loading || prev.itemsLoading;
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
  const money = (cents: number) => formatMoney(cents, group.currency);
  const nameOf = (uid: string) => (uid === currentUserUid ? 'You' : memberName(group, uid));

  function selectMonth(month: string) {
    setMonth(month);
    setView('month');
  }

  const header = (
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-[22px] font-semibold tracking-tight text-ink">
        {view === 'year' ? year : formatMonthLabel(selectedMonth)}
      </h1>
      <SegmentedControl label="Summary period" options={PERIODS} value={view} onChange={setView} />
    </div>
  );

  if (view === 'year') {
    return (
      <div className="space-y-6">
        {header}
        <Suspense fallback={<RouteSkeleton />}>
          <YearSummary group={group} year={year} onSelectMonth={selectMonth} />
        </Suspense>
      </div>
    );
  }

  // Month-only data gates only the Month view, so the Year view and the toggle
  // stay put while month subscriptions reload.
  if (expensesLoading || itemsLoading || settlementsLoading || incomeLoading) {
    return (
      <div className="space-y-6">
        {header}
        <RouteSkeleton />
      </div>
    );
  }

  const items = Object.values(itemsByExpense).flat();
  const prevThroughDay = comparablePrevDays(selectedMonth);
  const summary = computeSummary(group.memberUids, items, settlements);
  const breakdown = computeMonthBreakdown({
    items,
    expenses,
    income,
    prevItems: prevLoading ? null : Object.values(prev.itemsByExpense).flat(),
    prevExpenses: prev.expenses,
    prevThroughDay,
    daysElapsed: daysElapsedInMonth(selectedMonth),
  });
  const comparedWith = comparisonLabel(prevMonth, prevThroughDay);
  const pendingTransactions = summary.transactions;
  const paidSettlements = settlements.filter((s) => s.paid);
  const incomeOf = (uid: string) => income.filter((i) => i.uid === uid).reduce((sum, i) => sum + i.amount, 0);

  async function run(action: () => Promise<void>) {
    setActionError(null);
    setIsPending(true);
    try {
      await action();
    } catch {
      setActionError('Failed. Try again.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {header}

      {/* Settle up */}
      <section className="card p-5">
        <h2 className="mb-3 text-base font-semibold text-ink">Settle up</h2>
        {pendingTransactions.length === 0 ? (
          <p className="flex items-center gap-2 text-sm font-medium text-accent-ink">
            <CircleCheck size={18} strokeWidth={1.75} aria-hidden="true" />
            All settled
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {pendingTransactions.map((txn) => (
              <li key={`${txn.fromUid}-${txn.toUid}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="flex items-center">
                  <Avatar name={memberName(group, txn.fromUid)} tone={txn.fromUid === currentUserUid ? 'me' : 'them'} />
                  <span className="-ml-2">
                    <Avatar name={memberName(group, txn.toUid)} tone={txn.toUid === currentUserUid ? 'me' : 'them'} ring />
                  </span>
                </span>
                <span className="min-w-0 flex-1 text-sm text-ink">
                  {nameOf(txn.fromUid)} <span className="text-ink-muted">→</span> {nameOf(txn.toUid)}
                </span>
                <span className="money text-sm font-semibold text-ink">{money(txn.amount)}</span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void run(() =>
                    markSettlementPaid(group.id, selectedMonth, txn, currentUserUid, settlements))}
                  className="btn-primary h-8 px-3 text-xs"
                >
                  Mark paid
                </button>
              </li>
            ))}
          </ul>
        )}
        {paidSettlements.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
            {paidSettlements.map((s) => {
              const paidAt = s.paidAt?.toDate?.();
              return (
                <li key={s.id} className="flex items-center gap-3 text-sm text-ink-muted">
                  <span className="min-w-0 flex-1">
                    {nameOf(s.fromUid)} → {nameOf(s.toUid)}{' '}
                    <span className="money">{money(s.amount)}</span>
                  </span>
                  <span className="text-xs">{paidAt ? `Paid ${format(paidAt, 'd MMM')}` : 'Paid'}</span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => void run(() => removeSettlement(group.id, s.id))}
                    className="btn-ghost h-8 px-2.5 text-xs"
                  >
                    Undo
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {actionError && <p className="mt-2 text-sm text-negative">{actionError}</p>}
      </section>

      <MonthOverview
        breakdown={breakdown}
        sharedTotal={summary.sharedTotal}
        currency={group.currency}
        comparedWith={comparedWith}
      />

      {/* Per person */}
      <section className="card overflow-hidden p-5">
        <h2 className="mb-3 text-base font-semibold text-ink">Per person</h2>

        {/* Mobile rows (hidden on lg+) */}
        <ul className="divide-y divide-line lg:hidden">
          {group.memberUids.map((uid) => {
            const copy = memberBalanceCopy(summary.balance[uid] ?? 0, uid === currentUserUid, group.currency);
            const memberIncome = incomeOf(uid);
            return (
              <li key={uid} data-testid="balance-card" className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                <Avatar name={memberName(group, uid)} tone={uid === currentUserUid ? 'me' : 'them'} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-ink">{memberName(group, uid)}</span>
                    <BalanceCopy copy={copy} />
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    Paid <span className="money">{money(summary.paidTotal[uid] ?? 0)}</span>
                    {' · '}Share <span className="money">{money(summary.shareOf[uid] ?? 0)}</span>
                    {memberIncome > 0 && <>{' · '}Income <span className="money">{money(memberIncome)}</span></>}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        {/* Table (lg+) */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th className="pb-2 font-medium">Member</th>
                <th className="pb-2 text-right font-medium">Paid</th>
                <th className="pb-2 text-right font-medium">Share</th>
                <th className="pb-2 text-right font-medium">Income</th>
                <th className="pb-2 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {group.memberUids.map((uid) => {
                const copy = memberBalanceCopy(summary.balance[uid] ?? 0, uid === currentUserUid, group.currency);
                const memberIncome = incomeOf(uid);
                return (
                  <tr key={uid} className="border-b border-line last:border-0">
                    <td className="py-2.5 font-medium text-ink">{memberName(group, uid)}</td>
                    <td className="money py-2.5 text-right text-ink">{money(summary.paidTotal[uid] ?? 0)}</td>
                    <td className="money py-2.5 text-right text-ink">{money(summary.shareOf[uid] ?? 0)}</td>
                    <td className="money py-2.5 text-right text-ink">
                      {memberIncome > 0 ? money(memberIncome) : <span className="text-ink-muted">-</span>}
                    </td>
                    <td className="py-2.5 text-right"><BalanceCopy copy={copy} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <CategoryBreakdown
        categories={breakdown.categories}
        currency={group.currency}
        comparedWith={comparedWith}
      />
      <TopShops shops={breakdown.topShops} currency={group.currency} />
    </div>
  );
}
