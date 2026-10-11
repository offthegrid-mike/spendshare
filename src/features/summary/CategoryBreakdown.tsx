import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatMoney } from '../../lib/money';
import type { MonthCategory } from '../../lib/monthSummary';

interface Props {
  categories: MonthCategory[];
  currency: string;
  /** Name of the month before, e.g. "September". */
  prevMonthLabel: string;
  /** Changes are against last month's pace, because this month isn't over. */
  paced: boolean;
}

interface ChangeProps {
  change: MonthCategory['change'];
  prevMonthLabel: string;
  paced: boolean;
}

function Change({ change, prevMonthLabel, paced }: ChangeProps) {
  if (change === null) return null;
  if (change === 'new') return <span className="text-xs text-ink-muted">New</span>;
  const pct = Math.round(Math.abs(change));
  if (pct === 0) return null;
  const up = change > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      role="img"
      aria-label={`${up ? 'Up' : 'Down'} ${pct}% ${paced ? `on ${prevMonthLabel}’s pace` : `from ${prevMonthLabel}`}`}
      className={`flex items-center gap-0.5 text-xs ${up ? 'text-negative' : 'text-accent-ink'}`}
    >
      <Icon size={13} strokeWidth={1.75} aria-hidden="true" />
      {pct}%
    </span>
  );
}

/** Where the month's money went: a bar per category, with its change since last month. */
export default function CategoryBreakdown({ categories, currency, prevMonthLabel, paced }: Props) {
  if (categories.length === 0) return null;

  return (
    <section className="card p-5">
      <h2 className="mb-3 text-base font-semibold text-ink">By category</h2>
      <ul className="divide-y divide-line">
        {categories.map((c) => (
          <li key={c.category} data-testid="category-row" className="py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-ink">{c.category}</span>
              <span className="flex shrink-0 items-baseline gap-2.5">
                <Change change={c.change} prevMonthLabel={prevMonthLabel} paced={paced} />
                <span className="money text-ink">{formatMoney(c.amount, currency)}</span>
                <span className="w-9 text-right text-xs text-ink-muted">{Math.round(c.pct)}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-recessed" aria-hidden="true">
              <div
                data-testid="category-bar"
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.round(c.pct * 100) / 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
