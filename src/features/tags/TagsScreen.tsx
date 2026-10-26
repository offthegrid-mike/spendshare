import { Link } from 'react-router-dom';
import { ChevronRight, Tags } from 'lucide-react';
import { RouteSkeleton } from '../../components/AppSkeletons';
import { useAllExpenses } from '../../hooks/useAllExpenses';
import { formatMonthLabel } from '../../lib/month';
import { formatMoney } from '../../lib/money';
import { paths } from '../../lib/paths';
import { tagTotals } from '../../lib/tags';
import type { GroupDoc } from '../../types/models';

/** Every tag in the group's history with what its items add up to, refunds taken off. */
export default function TagsScreen({ group }: { group: GroupDoc }) {
  const { expenses, itemsByExpense, loading, error } = useAllExpenses(group.id);

  if (error) return <p className="text-sm text-negative">{error}</p>;
  if (loading) return <RouteSkeleton />;

  const totals = tagTotals(expenses, itemsByExpense);
  if (totals.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm text-ink-muted">
        No tags yet. Tag items when you add or edit an expense, or tag every item in one go.
      </p>
    );
  }

  return (
    <div className="card divide-y divide-line overflow-hidden">
      {totals.map((t) => (
        <Link
          key={t.tag}
          to={paths.tag(t.tag)}
          className="flex min-h-[52px] items-center gap-3 px-4 py-2.5 transition hover:bg-recessed"
        >
          <Tags size={18} className="shrink-0 text-accent-ink" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{t.tag}</span>
            <span className="block text-xs text-ink-muted">
              {t.expenses} expense{t.expenses === 1 ? '' : 's'} · last {formatMonthLabel(t.lastMonth)}
            </span>
          </span>
          <span className="money shrink-0 text-sm font-semibold text-ink">{formatMoney(t.amount, group.currency)}</span>
          <ChevronRight size={16} className="shrink-0 text-ink-faint" aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
