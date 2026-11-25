import { Link } from 'react-router-dom';
import { ChevronRight, Plane } from 'lucide-react';
import { useSettlements } from '../../hooks/useSettlements';
import { useTripExpenses } from '../../hooks/useTripExpenses';
import { useWorkClock } from '../../hooks/useWorkClock';
import { formatMinor } from '../../lib/travel/currency';
import { TRIP_SETTLEMENT_MONTH, viewerTripFigures } from '../../lib/travel/valueTrip';
import { paths } from '../../lib/paths';
import { featuredTrip, formatTripDates, tripProgress } from '../../lib/travel/trips';
import { progressText } from '../travel/tripText';
import type { GroupDoc } from '../../types/models';

const LINE = 'flex items-baseline justify-between gap-3 border-t border-line py-2 text-[13px] text-ink-muted';
const BALANCE_TONE = { owed: 'text-accent-ink', owe: 'text-negative', settled: 'text-ink' } as const;

/** Home's Travel tile: the trip under way or the next one, what's been spent and your balance, with a way into Travel. */
export default function TravelTile({ trips, viewerUid }: { trips: GroupDoc[]; viewerUid: string }) {
  const { today } = useWorkClock();
  const trip = featuredTrip(trips, today);
  // Only the featured trip's expenses load; with none featured, nothing does.
  const { expenses, itemsByExpense, loading, itemsLoading } = useTripExpenses(trip?.id ?? null);
  const { settlements, loading: settlementsLoading } = useSettlements(trip?.id ?? null, TRIP_SETTLEMENT_MONTH);
  const figures = trip && !loading && !itemsLoading && !settlementsLoading
    ? viewerTripFigures(trip, viewerUid, expenses, itemsByExpense, settlements)
    : null;

  return (
    <section aria-label="Travel" className="card p-4">
      <Link
        to={paths.travel}
        className="mb-2 flex min-w-0 items-center gap-2.5 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent-ink">
          <Plane size={18} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <h2 className="text-base font-semibold text-ink">Travel</h2>
          <span className="block text-xs text-ink-muted">Shared trip costs, in any currency</span>
        </span>
        <ChevronRight size={18} strokeWidth={1.75} className="ml-auto text-ink-faint" aria-hidden="true" />
      </Link>

      {trip?.trip ? (
        <Link
          to={paths.trip(trip.id)}
          className="block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <p className={LINE}>
            <span className="truncate font-medium text-ink">{trip.name}</span>
            <span className="shrink-0">{formatTripDates(trip.trip)}</span>
          </p>
          <p className={LINE}>
            <span>{tripProgress(trip.trip, today).status === 'current' ? 'Under way' : 'Next trip'}</span>
            <span className="font-medium text-ink">{progressText(tripProgress(trip.trip, today))}</span>
          </p>
          {figures && (
            <>
              <p className={LINE}>
                <span>Spent so far</span>
                <span className="money text-ink">{`${figures.estimated ? '≈ ' : ''}${formatMinor(figures.spent, trip.currency)}`}</span>
              </p>
              <p className={LINE}>
                <span>Your balance</span>
                <span className={`font-semibold ${BALANCE_TONE[figures.balance.tone]}`}>
                  {`${figures.balance.verb}${figures.balance.amount ? ` ${figures.balance.amount}` : ''}`}
                </span>
              </p>
            </>
          )}
        </Link>
      ) : (
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <Link to={paths.newTrip} className="btn-outline">
            Plan a trip
          </Link>
          {trips.length > 0 && (
            <Link to={paths.travel} className="text-[13px] font-medium text-ink-muted hover:text-ink">
              {`All trips (${trips.length})`}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
