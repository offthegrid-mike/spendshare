import { formatMoney } from '../../lib/money';
import { daysLeftText, percentUsed, type BudgetRow, type BudgetStatus } from '../../lib/budget';

interface Props {
  rows: BudgetRow[];
  /** Percent of the month gone, for a month in progress; null draws no pace line. */
  pace: number | null;
  daysLeft: number;
  currency: string;
}

// Amber from 80% used and red once over, with the words beside the bar so colour isn't all there is to it.
const BAR: Record<BudgetStatus, string> = { ok: 'bg-accent', warn: 'bg-warning', over: 'bg-negative' };
const NOTE: Record<BudgetStatus, string> = { ok: 'text-ink-muted', warn: 'text-warning', over: 'text-negative' };

/** Each budgeted category's spending against its monthly limit, with where an even pace through the month would be. */
export default function BudgetsCard({ rows, pace, daysLeft, currency }: Props) {
  if (rows.length === 0) return null;
  const money = (cents: number) => formatMoney(cents, currency);
  const note = (row: BudgetRow) =>
    row.remaining > 0 ? `${money(row.remaining)} left` : row.remaining === 0 ? 'Fully used' : `${money(-row.remaining)} over`;

  return (
    <section className="card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="text-base font-semibold text-ink">Budgets</h2>
        {pace !== null && <p className="text-xs text-ink-muted">{daysLeftText(daysLeft)}</p>}
      </div>
      <ul className="divide-y divide-line">
        {rows.map((row) => (
          <li key={row.categoryId} data-testid="budget-row" className="py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-ink">{row.name}</span>
              <span className="flex shrink-0 items-baseline gap-2.5">
                <span className="text-ink">
                  <span className="money">{money(row.spent)}</span> of <span className="money">{money(row.limit)}</span>
                </span>
                <span className="w-9 text-right text-xs text-ink-muted">{percentUsed(row)}%</span>
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={`${row.name} budget`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(percentUsed(row), 100)}
              aria-valuetext={`${money(row.spent)} of ${money(row.limit)}`}
              className="relative mt-1.5 h-1.5 rounded-full bg-recessed"
            >
              <div
                data-testid="budget-bar"
                className={`h-full rounded-full ${BAR[row.status]}`}
                style={{ width: `${Math.min(Math.round(row.pct * 100) / 100, 100)}%` }}
              />
              {pace !== null && (
                <div
                  data-testid="budget-pace"
                  aria-hidden="true"
                  className="absolute -top-0.5 h-2.5 w-0.5 -translate-x-1/2 rounded-full bg-ink/70"
                  style={{ left: `${Math.round(pace * 100) / 100}%` }}
                />
              )}
            </div>
            <p className={`mt-1 text-xs ${NOTE[row.status]}`}>{note(row)}</p>
          </li>
        ))}
      </ul>
      {pace !== null && <p className="mt-3 text-xs text-ink-faint">The line marks an even pace through the month.</p>}
    </section>
  );
}
