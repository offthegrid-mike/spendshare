import { Link } from 'react-router-dom';
import { incomeYearLabel } from '../../lib/work/workDates';
import type { ResolvedRate } from '../../lib/work/workRates';
import { formatHours } from '../../lib/work/workTime';
import type { WorkYearSummary } from '../../lib/work/workYear';
import { paths } from '../../lib/paths';

// The income year so far: the Home hours in the claim and what they come to at the
// year's rate, with a line each for late days still out of the claim and counted
// days whose finish is unconfirmed.

interface Props {
  summary: WorkYearSummary;
  rate: ResolvedRate;
  /** 'YYYY-YY', e.g. '2026-27'. */
  incomeYear: string;
}

const LINE = 'flex items-baseline justify-between gap-3 border-t border-line py-2 text-[13px] text-ink-muted';

function dayCount(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

export default function YearToDateCard({ summary, rate, incomeYear }: Props) {
  const { counted, addedLater, notConfirmed } = summary;

  return (
    <section className="card p-4">
      <h2 className="mb-2 text-sm font-semibold text-ink-muted">{`Income year ${incomeYearLabel(incomeYear)} so far`}</h2>
      <p className="money text-3xl font-semibold text-ink">{`${formatHours(counted.minutes)} h`}</p>
      <p className="mb-3 text-sm text-ink-muted">{`from home · ${dayCount(counted.days)}`}</p>

      <p className={LINE}>
        <span>Fixed rate claim</span>
        <span>
          <span className="money font-semibold text-ink">{`≈ $${summary.claimDollars.toLocaleString('en-US')}`}</span>{' '}
          <span>{`at ${rate.cents}c/h`}</span>
        </span>
      </p>
      {rate.source === 'carried' && rate.carriedFrom !== undefined && (
        <p className={LINE}>
          <span>{`${rate.cents}c is the ${incomeYearLabel(rate.carriedFrom)} rate until you set one`}</span>
          <Link
            to={paths.workMore}
            className="shrink-0 rounded font-semibold text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            Set the rate
          </Link>
        </p>
      )}
      {addedLater.days > 0 && (
        <p className={LINE}>{`Added later · ${dayCount(addedLater.days)} · ${formatHours(addedLater.minutes)} h · not in the claim`}</p>
      )}
      {notConfirmed.days > 0 && (
        <p className={LINE}>{`Not confirmed · ${dayCount(notConfirmed.days)} · ${formatHours(notConfirmed.minutes)} h · still counted`}</p>
      )}
    </section>
  );
}
