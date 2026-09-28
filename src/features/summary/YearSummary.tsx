import { formatMoney } from '../../lib/money';
import { computeYearSummary, foldCategories } from '../../lib/yearSummary';
import { useYearItems } from '../../hooks/useYearItems';
import { useYearIncome } from '../../hooks/useYearIncome';
import { CategoryChart, MonthChart } from './YearCharts';
import type { GroupDoc } from '../../types/models';

interface Props {
  group: GroupDoc;
  year: string;
  onSelectMonth: (month: string) => void;
}

export default function YearSummary({ group, year, onSelectMonth }: Props) {
  const { items, loading: itemsLoading } = useYearItems(group.id, year);
  const { income, loading: incomeLoading } = useYearIncome(group.id, year);

  if (itemsLoading || incomeLoading) {
    return <div>Loading…</div>;
  }

  const s = computeYearSummary(year, group.memberUids, items, income);
  const money = (cents: number) => formatMoney(cents, group.currency);
  const isEmpty = s.grandTotal === 0 && s.incomeTotal === 0;
  const netClass = s.net > 0 ? 'text-brand-700' : s.net < 0 ? 'text-rose-600' : 'text-slate-500';

  function memberName(uid: string): string {
    return group.members[uid]?.displayName ?? uid;
  }

  return (
    <div className="space-y-6">
      {/* Year totals */}
      <section className="card p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Year totals — {year}</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Spending (all items)</span>
            <span data-testid="year-total-spending" className="font-semibold tabular-nums text-slate-900">{money(s.grandTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Shared spending</span>
            <span data-testid="year-total-shared" className="font-semibold tabular-nums text-slate-900">{money(s.sharedTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Income</span>
            <span data-testid="year-total-income" className="font-semibold tabular-nums text-slate-900">{money(s.incomeTotal)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2">
            <span className="font-semibold text-slate-700">Net (income − spending)</span>
            <span data-testid="year-net" className={`font-bold tabular-nums ${netClass}`}>{money(s.net)}</span>
          </div>
        </div>
        {isEmpty && (
          <p className="mt-3 text-sm text-slate-400">No spending or income recorded for {year}.</p>
        )}
      </section>

      {/* Per person */}
      <section className="card overflow-hidden p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Per person</h2>

        <div className="space-y-3 sm:hidden">
          {group.memberUids.map((uid) => {
            const p = s.perPerson[uid];
            return (
              <div key={uid} data-testid="year-person-card" className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="mb-1 font-semibold text-slate-900">{memberName(uid)}</p>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Paid {money(p.paid)}</span>
                  <span>Share {money(p.share)}</span>
                  <span>Income {p.income > 0 ? money(p.income) : '—'}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2 font-semibold">Member</th>
                <th className="pb-2 font-semibold text-right">Total paid</th>
                <th className="pb-2 font-semibold text-right">Equal share</th>
                <th className="pb-2 font-semibold text-right">Income</th>
              </tr>
            </thead>
            <tbody>
              {group.memberUids.map((uid) => {
                const p = s.perPerson[uid];
                return (
                  <tr key={uid} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 font-medium text-slate-800">{memberName(uid)}</td>
                    <td className="py-2.5 text-right tabular-nums text-slate-600">{money(p.paid)}</td>
                    <td className="py-2.5 text-right tabular-nums text-slate-600">{money(p.share)}</td>
                    <td className="py-2.5 text-right tabular-nums text-slate-600">{p.income > 0 ? money(p.income) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {!isEmpty && (
        <>
          {/* Month by month */}
          <section className="card p-5">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Month by month</h2>
            <MonthChart
              months={s.months}
              currency={group.currency}
              avgSpending={s.avgSpending}
              avgIncome={s.avgIncome}
              onSelectMonth={onSelectMonth}
            />
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 font-semibold">Month</th>
                  <th className="pb-2 font-semibold text-right">Spending</th>
                  <th className="pb-2 font-semibold text-right">Income</th>
                </tr>
              </thead>
              <tbody>
                {s.months.map((m) => {
                  const empty = m.spending === 0 && m.income === 0;
                  return (
                    <tr key={m.month} data-testid="year-month-row" className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5">
                        <button
                          type="button"
                          aria-label={`View ${m.label} ${year}`}
                          onClick={() => onSelectMonth(m.month)}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {m.label}
                        </button>
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-slate-600">{empty ? '—' : money(m.spending)}</td>
                      <td className="py-1.5 text-right tabular-nums text-slate-600">{empty ? '—' : money(m.income)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr data-testid="year-month-average" className="border-t border-slate-200 font-semibold text-slate-800">
                  <td className="pt-2">
                    Average{' '}
                    <span className="font-normal text-slate-400">
                      ({s.activeMonths} {s.activeMonths === 1 ? 'month' : 'months'})
                    </span>
                  </td>
                  <td className="pt-2 text-right tabular-nums">{money(s.avgSpending)}</td>
                  <td className="pt-2 text-right tabular-nums">{money(s.avgIncome)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* By category */}
          {s.categories.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-3 text-base font-semibold text-slate-900">By category</h2>
              <CategoryChart categories={foldCategories(s.categories)} currency={group.currency} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
