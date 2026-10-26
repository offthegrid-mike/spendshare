import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import Chip from '../../components/ui/Chip';
import { RouteSkeleton } from '../../components/AppSkeletons';
import { useAllExpenses } from '../../hooks/useAllExpenses';
import { formatMonthLabel } from '../../lib/month';
import { formatMoney } from '../../lib/money';
import { paths } from '../../lib/paths';
import { isRefund } from '../../lib/refund';
import { tagExpenses } from '../../lib/tags';
import type { ExpenseDoc, GroupDoc } from '../../types/models';

/** One tag: its total, and its expenses by month, each with what it spent on the tag. */
export default function TagScreen({ group, tag }: { group: GroupDoc; tag: string }) {
  const { expenses, itemsByExpense, loading, error } = useAllExpenses(group.id);

  if (error) return <p className="text-sm text-negative">{error}</p>;
  if (loading) return <RouteSkeleton />;

  const entries = tagExpenses(tag, expenses, itemsByExpense);
  if (entries.length === 0) {
    return <p className="px-1 py-8 text-center text-sm text-ink-muted">Nothing is tagged “{tag}”.</p>;
  }

  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  const months: { month: string; entries: { expense: ExpenseDoc; amount: number }[] }[] = [];
  for (const entry of entries) {
    const last = months[months.length - 1];
    if (last?.month === entry.expense.month) last.entries.push(entry);
    else months.push({ month: entry.expense.month, entries: [entry] });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="money text-[28px] font-semibold tracking-[-0.03em] text-ink">{formatMoney(total, group.currency)}</p>
        <p className="text-xs text-ink-muted">
          across {entries.length} expense{entries.length === 1 ? '' : 's'}, refunds taken off
        </p>
      </div>
      {months.map(({ month, entries: monthEntries }) => {
        const headingId = `tag-month-${month}`;
        return (
          <section key={month} aria-labelledby={headingId} className="space-y-2">
            <h2 id={headingId} className="px-1 text-xs font-medium text-ink-muted">{formatMonthLabel(month)}</h2>
            <div className="card divide-y divide-line overflow-hidden">
              {monthEntries.map(({ expense, amount }) => (
                <Link
                  key={expense.id}
                  to={paths.editExpense(expense.id)}
                  className="flex min-h-[48px] items-center gap-3 px-4 py-2.5 transition hover:bg-recessed"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-ink">{expense.shopName}</span>
                      {isRefund(expense) && <Chip>Refund</Chip>}
                    </span>
                    <span className="block text-xs text-ink-muted">{format(expense.date.toDate(), 'EEE d MMM')}</span>
                  </span>
                  <span className={`money shrink-0 text-sm font-semibold ${amount < 0 ? 'text-accent' : 'text-ink'}`}>
                    {formatMoney(amount, group.currency)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
