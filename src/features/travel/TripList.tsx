import type { User } from 'firebase/auth';
import { Link } from 'react-router-dom';
import { ChevronRight, Plane, Plus } from 'lucide-react';
import { useWorkClock } from '../../hooks/useWorkClock';
import { paths } from '../../lib/paths';
import { formatTripDates, sortTrips, tripProgress, tripStatus, type TripStatus } from '../../lib/travel/trips';
import PendingInvites from '../invites/PendingInvites';
import { peopleText, progressText } from './tripText';
import type { GroupDoc } from '../../types/models';

interface Props { trips: GroupDoc[]; user: User; }

const SECTIONS: { status: TripStatus; title: string }[] = [
  { status: 'current', title: 'Now' },
  { status: 'upcoming', title: 'Upcoming' },
  { status: 'past', title: 'Past' },
];

function TripRow({ trip, today }: { trip: GroupDoc; today: string }) {
  if (!trip.trip) return null;
  return (
    <li>
      <Link
        to={paths.trip(trip.id)}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-recessed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{trip.name}</span>
          <span className="block text-xs text-ink-muted">{formatTripDates(trip.trip)}</span>
          <span className="block text-xs text-ink-muted">
            {`${progressText(tripProgress(trip.trip, today))} · ${peopleText(trip.memberUids.length)}`}
          </span>
        </span>
        <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-faint" aria-hidden="true" />
      </Link>
    </li>
  );
}

/** Every trip the user is on, under Now, Upcoming and Past, with a way to start a new one. */
export default function TripList({ trips, user }: Props) {
  const { today } = useWorkClock();
  const sorted = sortTrips(trips.filter((t) => t.trip), today);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Trips</h2>
        <Link to={paths.newTrip} className="btn-primary">
          <Plus size={14} aria-hidden="true" />
          New trip
        </Link>
      </div>

      <div className="empty:hidden">
        <PendingInvites user={user} />
      </div>

      {sorted.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-accent-soft text-accent-ink">
            <Plane size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">No trips yet</p>
            <p className="mt-1 text-[13px] text-ink-muted">
              Start one, invite the people going, and keep track of who paid for what in any currency.
            </p>
          </div>
          <Link to={paths.newTrip} className="btn-outline">
            New trip
          </Link>
        </div>
      ) : (
        SECTIONS.map(({ status, title }) => {
          const inSection = sorted.filter((t) => t.trip && tripStatus(t.trip, today) === status);
          if (inSection.length === 0) return null;
          const headingId = `trips-${status}`;
          return (
            <section key={status} aria-labelledby={headingId}>
              <h3 id={headingId} className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                {title}
              </h3>
              <ul className="card divide-y divide-line overflow-hidden">
                {inSection.map((trip) => (
                  <TripRow key={trip.id} trip={trip} today={today} />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
