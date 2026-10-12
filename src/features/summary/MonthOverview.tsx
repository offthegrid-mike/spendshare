import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatMoney } from '../../lib/money';
import type { MonthBreakdown } from '../../lib/monthSummary';
import Stat from '../../components/ui/Stat';

interface Props {
  breakdown: MonthBreakdown;
  sharedTotal: number;
  currency: string;
  /** What spending is measured against: "September", or "1–12 September" while this month is in progress. */
  comparedWith: string;
}

interface VsPrevProps {
  vsPrev: NonNullable<MonthBreakdown['vsPrev']>;
  comparedWith: string;
}

function VsPrev({ vsPrev, comparedWith }: VsPrevProps) {
  const pct = Math.round(Math.abs(vsPrev.pct));
  if (pct === 0) {
    return (
      <p data-testid="month-vs-prev" className="text-sm text-ink-muted">
        About the same as {comparedWith}
      </p>
    );
  }
  const up = vsPrev.amount > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const text = `${pct}% ${up ? 'more' : 'less'} than ${comparedWith}`;
  return (
    <p data-testid="month-vs-prev" className={`flex items-center gap-1.5 text-sm font-medium ${up ? 'text-negative' : 'text-accent-ink'}`}>
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
      {text}
    </p>
  );
}

/** The Month view's headline: spending, what is left of the income, and how it compares with last month. */
export default function MonthOverview({ breakdown: b, sharedTotal, currency, comparedWith }: Props) {
  if (b.spent === 0) return null;
  const money = (cents: number) => formatMoney(cents, currency);

  return (
    <section aria-label="Overview" className="space-y-3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Stat label="Spent" value={money(b.spent)} testId="month-spent" />
        {b.income > 0 && (
          <>
            <Stat label="Income" value={money(b.income)} testId="month-income" />
            <Stat label="Net saved" value={money(b.saved)} testId="month-saved" />
            {b.savingsRate !== null && (
              <Stat label="Savings rate" value={`${Math.round(b.savingsRate)}%`} testId="month-savings-rate" />
            )}
          </>
        )}
      </div>
      {b.vsPrev && <VsPrev vsPrev={b.vsPrev} comparedWith={comparedWith} />}
      <p data-testid="month-details" className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-muted">
        <span><span className="money text-ink">{money(sharedTotal)}</span> shared</span>
        {b.dailyAverage > 0 && (
          <span>Daily average <span className="money text-ink">{money(b.dailyAverage)}</span></span>
        )}
        {b.biggestExpense && (
          <span>
            Biggest: {b.biggestExpense.shopName}{' '}
            <span className="money text-ink">{money(b.biggestExpense.amount)}</span>
          </span>
        )}
      </p>
    </section>
  );
}
