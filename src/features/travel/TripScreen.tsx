import { Link, useParams } from 'react-router-dom';
import { ReceiptText, Settings } from 'lucide-react';
import Avatar from '../../components/ui/Avatar';
import { useWorkClock } from '../../hooks/useWorkClock';
import { paths } from '../../lib/paths';
import { formatTripDates, tripProgress } from '../../lib/travel/trips';
import { progressText } from './tripText';
import type { GroupDoc } from '../../types/models';

interface Props { trips: GroupDoc[]; viewerUid: string; }

/** One trip's overview: dates, who's going, and (from T2) its expenses. */
export default function TripScreen({ trips, viewerUid }: Props) {
  const { tripId } = useParams<{ tripId: string }>();
  const { today } = useWorkClock();
  const trip = trips.find((t) => t.id === tripId);

  if (!trip?.trip) {
    return (
      <div className="card mx-auto max-w-lg p-6 text-center">
        <p className="text-sm font-semibold text-ink">Trip not found</p>
        <p className="mt-1 text-[13px] text-ink-muted">It may have been deleted, or you may no longer be on it.</p>
        <Link to={paths.travel} className="btn-outline mt-4">All trips</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <section className="card p-4 sm:p-5">
        <h2 className="text-xl font-semibold tracking-tight text-ink">{trip.name}</h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">{formatTripDates(trip.trip)}</p>
        <p className="mt-2 text-sm font-medium text-ink">{progressText(tripProgress(trip.trip, today))}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{`Home currency: ${trip.currency}`}</p>

        <h3 className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Who’s going</h3>
        <ul aria-label="Who’s going" className="flex flex-wrap gap-2">
          {trip.memberUids.map((uid) => {
            const name = trip.members[uid]?.displayName || uid;
            return (
              <li key={uid} className="flex items-center gap-1.5 rounded-full bg-recessed py-1 pl-1 pr-2.5 text-[13px] text-ink">
                <Avatar name={name} size="sm" tone={uid === viewerUid ? 'me' : 'them'} />
                {uid === viewerUid ? `${name} (you)` : name}
              </li>
            );
          })}
        </ul>

        <Link to={paths.tripSettings(trip.id)} className="btn-outline mt-4">
          <Settings size={14} aria-hidden="true" />
          Members and settings
        </Link>
      </section>

      <section className="card flex items-start gap-3 p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-recessed text-ink-muted">
          <ReceiptText size={18} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">Expenses</p>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Recording what you spend, in any currency, comes in the next update.
          </p>
        </div>
      </section>
    </div>
  );
}
