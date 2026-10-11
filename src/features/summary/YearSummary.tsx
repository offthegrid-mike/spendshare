import { formatMoney } from '../../lib/money';
import { computeYearSummary, foldCategories } from '../../lib/yearSummary';
import { memberName } from '../../lib/balance';
import { useYearItems } from '../../hooks/useYearItems';
import { useYearIncome } from '../../hooks/useYearIncome';
import { RouteSkeleton } from '../../components/AppSkeletons';
import Avatar from '../../components/ui/Avatar';
import Stat from '../../components/ui/Stat';
import { CategoryChart, MonthChart } from './YearCharts';
import type { GroupDoc } from '../../types/models';

interface Props {
  group: GroupDoc;
  year: string;
  onSelectMonth: (month: string) => void;
}

const Dash = () => <span className="text-ink-muted">-</span>;

export default function YearSummary({ group, year, onSelectMonth }: Props) {
  const { items, loading: itemsLoading } = useYearItems(group.id, year);
  const { income, loading: incomeLoading } = useYearIncome(group.id, year);

  if (itemsLoading || incomeLoading) return <RouteSkeleton />;

  const s = computeYearSummary(year, group.memberUids, items, income);
  const money = (cents: number) => formatMoney(cents, group.currency);
  const isEmpty = s.grandTotal === 0 && s.incomeTotal === 0;

  return (
    <div className="space-y-6">
      {/* Year stats */}
      <section aria-label={`${year} totals`}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Stat label="Spent" value={money(s.grandTotal)} testId="year-total-spending" />
          <Stat label="Avg / month" value={money(s.avgSpending)} testId="year-avg-spending" />
          <Stat label="Income" value={money(s.incomeTotal)} testId="year-total-income" />
          <Stat label="Avg income" value={money(s.avgIncome)} testId="year-avg-income" />
        </div>
        {isEmpty && <p className="mt-3 text-sm text-ink-muted">No spending or income recorded for {year}.</p>}
      </section>

      {/* Per person */}
      <section className="card overflow-hidden p-5">
        <h2 className="mb-3 text-base font-semibold text-ink">Per person</h2>

        <ul className="divide-y divide-line lg:hidden">
          {group.memberUids.map((uid) => {
            const p = s.perPerson[uid];
            return (
              <li key={uid} data-testid="year-person-card" className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <Avatar name={memberName(group, uid)} tone="them" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{memberName(group, uid)}</span>
                  <span className="money block text-xs text-ink-muted">
                    Paid {money(p.paid)} · Share {money(p.share)} · Income {p.income > 0 ? money(p.income) : '-'}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th className="pb-2 font-medium">Member</th>
                <th className="pb-2 text-right font-medium">Paid</th>
                <th className="pb-2 text-right font-medium">Share</th>
                <th className="pb-2 text-right font-medium">Income</th>
              </tr>
            </thead>
            <tbody>
              {group.memberUids.map((uid) => {
                const p = s.perPerson[uid];
                return (
                  <tr key={uid} className="border-b border-line last:border-0">
                    <td className="py-2.5 font-medium text-ink">{memberName(group, uid)}</td>
                    <td className="money py-2.5 text-right text-ink">{money(p.paid)}</td>
                    <td className="money py-2.5 text-right text-ink">{money(p.share)}</td>
                    <td className="money py-2.5 text-right text-ink">{p.income > 0 ? money(p.income) : <Dash />}</td>
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
            <h2 className="mb-3 text-base font-semibold text-ink">Month by month</h2>
            <MonthChart
              months={s.months}
              currency={group.currency}
              avgSpending={s.avgSpending}
              avgIncome={s.avgIncome}
              onSelectMonth={onSelectMonth}
            />
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th className="pb-2 font-medium">Month</th>
                  <th className="pb-2 text-right font-medium">Spending</th>
                  <th className="pb-2 text-right font-medium">Income</th>
                </tr>
              </thead>
              <tbody>
                {s.months.map((m) => {
                  const empty = m.spending === 0 && m.income === 0;
                  return (
                    <tr key={m.month} data-testid="year-month-row" className="border-b border-line last:border-0">
                      <td className="py-1.5">
                        <button
                          type="button"
                          aria-label={`View ${m.label} ${year}`}
                          onClick={() => onSelectMonth(m.month)}
                          className="font-medium text-accent-ink hover:underline"
                        >
                          {m.label}
                        </button>
                      </td>
                      <td className="money py-1.5 text-right text-ink">{empty ? <Dash /> : money(m.spending)}</td>
                      <td className="money py-1.5 text-right text-ink">{empty ? <Dash /> : money(m.income)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr data-testid="year-month-average" className="border-t border-line font-semibold text-ink">
                  <td className="pt-2">
                    Average{' '}
                    <span className="font-normal text-ink-muted">
                      ({s.activeMonths} {s.activeMonths === 1 ? 'month' : 'months'})
                    </span>
                  </td>
                  <td className="money pt-2 text-right">{money(s.avgSpending)}</td>
                  <td className="money pt-2 text-right">{money(s.avgIncome)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* By category */}
          {s.categories.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-3 text-base font-semibold text-ink">By category</h2>
              <CategoryChart categories={foldCategories(s.categories)} currency={group.currency} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
