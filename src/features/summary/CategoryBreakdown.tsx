import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatMoney } from '../../lib/money';
import type { MonthCategory } from '../../lib/monthSummary';

interface Props {
  categories: MonthCategory[];
  currency: string;
  /** What the changes are measured against: "September", or "1–12 September" while this month is in progress. */
  comparedWith: string;
}

interface ChangeProps {
  change: MonthCategory['change'];
  comparedWith: string;
}

function Change({ change, comparedWith }: ChangeProps) {
  if (change === null) return null;
  if (change === 'new') return <span className="text-xs text-ink-muted">New</span>;
  const pct = Math.round(Math.abs(change));
  if (pct === 0) return null;
  const up = change > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      role="img"
      aria-label={`${up ? 'Up' : 'Down'} ${pct}% from ${comparedWith}`}
      className={`flex items-center gap-0.5 text-xs ${up ? 'text-negative' : 'text-accent-ink'}`}
    >
      <Icon size={13} strokeWidth={1.75} aria-hidden="true" />
      {pct}%
    </span>
  );
}

/** Where the month's money went: a bar per category, with its change since last month. */
export default function CategoryBreakdown({ categories, currency, comparedWith }: Props) {
  if (categories.length === 0) return null;
  const compared = categories.some((c) => c.change !== null);

  return (
    <section className="card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="text-base font-semibold text-ink">By category</h2>
        {compared && <p className="text-xs text-ink-muted">Change vs {comparedWith}</p>}
      </div>
      <ul className="divide-y divide-line">
        {categories.map((c) => (
          <li key={c.category} data-testid="category-row" className="py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-ink">{c.category}</span>
              <span className="flex shrink-0 items-baseline gap-2.5">
                <Change change={c.change} comparedWith={comparedWith} />
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
