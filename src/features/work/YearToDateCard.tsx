import { Link } from 'react-router-dom';
import { incomeYearLabel } from '../../lib/work/workDates';
import type { ResolvedRate } from '../../lib/work/workRates';
import { formatHours } from '../../lib/work/workTime';
import type { WorkYearSummary } from '../../lib/work/workYear';
import { paths } from '../../lib/paths';

// The income year so far: the Home hours in the claim and what they come to at the
// year's rate, with a line each for late days still out of the claim and counted
// days whose finish is unconfirmed. Those two lines link to their reviews on the
// Year tab, except on the Year tab itself, where the reviews sit below the card.

interface Props {
  summary: WorkYearSummary;
  rate: ResolvedRate;
  /** 'YYYY-YY', e.g. '2026-27'. */
  incomeYear: string;
  /** Link the added-later and not-confirmed lines to the Year tab's reviews. */
  linkToYear?: boolean;
  /** The income year has ended, so the heading drops "so far". */
  finished?: boolean;
}

const LINE = 'flex items-baseline justify-between gap-3 border-t border-line py-2 text-[13px] text-ink-muted';
const LINK =
  'shrink-0 rounded font-semibold text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';

function dayCount(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

export default function YearToDateCard({ summary, rate, incomeYear, linkToYear = true, finished = false }: Props) {
  const { counted, addedLater, notConfirmed } = summary;

  return (
    <section className="card p-4">
      <h2 className="mb-2 text-sm font-semibold text-ink-muted">{`Income year ${incomeYearLabel(incomeYear)}${finished ? '' : ' so far'}`}</h2>
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
          <Link to={paths.workMore} className={LINK}>
            Set the rate
          </Link>
        </p>
      )}
      {addedLater.days > 0 && (
        <p className={LINE}>
          <span>{`Added later · ${dayCount(addedLater.days)} · ${formatHours(addedLater.minutes)} h · not in the claim`}</span>
          {linkToYear && (
            <Link to={`${paths.workYear}#late`} className={LINK}>
              Include ›
            </Link>
          )}
        </p>
      )}
      {notConfirmed.days > 0 && (
        <p className={LINE}>
          <span>{`Not confirmed · ${dayCount(notConfirmed.days)} · ${formatHours(notConfirmed.minutes)} h · still counted`}</span>
          {linkToYear && (
            <Link to={`${paths.workYear}#confirm`} className={LINK}>
              Review ›
            </Link>
          )}
        </p>
      )}
    </section>
  );
}
