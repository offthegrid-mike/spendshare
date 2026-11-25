import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { GroupDoc, TripDates } from '../../types/models';

/**
 * A trip is a group with kind 'trip'. Households and trips come from the same
 * groups query, so every household screen works from `households` only.
 */
export function isTrip(group: Pick<GroupDoc, 'kind'>): boolean {
  return group.kind === 'trip';
}

export function splitGroups(groups: GroupDoc[]): { households: GroupDoc[]; trips: GroupDoc[] } {
  const households: GroupDoc[] = [];
  const trips: GroupDoc[] = [];
  for (const g of groups) (isTrip(g) ? trips : households).push(g);
  return { households, trips };
}

export type TripStatus = 'upcoming' | 'current' | 'past';

/** Where `today` ('YYYY-MM-DD') falls against the trip; ISO dates compare as strings. */
export function tripStatus(trip: TripDates, today: string): TripStatus {
  if (today < trip.startDate) return 'upcoming';
  if (today > trip.endDate) return 'past';
  return 'current';
}

function daysBetween(from: string, to: string): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

export type TripProgress =
  | { status: 'upcoming'; daysUntil: number; length: number }
  | { status: 'current'; day: number; length: number }
  | { status: 'past'; length: number };

/** Days until the trip, or which day of it today is (the first day is day 1), and its length in days. */
export function tripProgress(trip: TripDates, today: string): TripProgress {
  const length = daysBetween(trip.startDate, trip.endDate) + 1;
  const status = tripStatus(trip, today);
  if (status === 'upcoming') return { status, daysUntil: daysBetween(today, trip.startDate), length };
  if (status === 'current') return { status, day: daysBetween(trip.startDate, today) + 1, length };
  return { status, length };
}

const STATUS_ORDER: Record<TripStatus, number> = { current: 0, upcoming: 1, past: 2 };

/** Current trips, then upcoming soonest first, then past most recent first; a trip without dates goes last. */
export function sortTrips(trips: GroupDoc[], today: string): GroupDoc[] {
  return [...trips].sort((a, b) => {
    if (!a.trip || !b.trip) return Number(!a.trip) - Number(!b.trip);
    const byStatus = STATUS_ORDER[tripStatus(a.trip, today)] - STATUS_ORDER[tripStatus(b.trip, today)];
    if (byStatus !== 0) return byStatus;
    return tripStatus(a.trip, today) === 'past'
      ? b.trip.endDate.localeCompare(a.trip.endDate)
      : a.trip.startDate.localeCompare(b.trip.startDate);
  });
}

/** The trip Home shows: the current one, else the next one, else none. */
export function featuredTrip(trips: GroupDoc[], today: string): GroupDoc | null {
  const first = sortTrips(trips, today)[0];
  return first?.trip && tripStatus(first.trip, today) !== 'past' ? first : null;
}

export interface TripInput { name: string; startDate: string; endDate: string; }

/** What's wrong with a new or edited trip, or null when it can be saved. */
export function validateTripInput(input: TripInput): string | null {
  if (!input.name.trim()) return 'Enter a trip name.';
  if (!input.startDate) return 'Choose the first day of the trip.';
  if (!input.endDate) return 'Choose the last day of the trip.';
  if (input.endDate < input.startDate) return 'The last day can’t be before the first.';
  return null;
}

/** "10–20 May 2027", "28 May – 3 Jun 2027", "28 Dec 2026 – 3 Jan 2027", or one date for a one-day trip. */
export function formatTripDates(trip: TripDates): string {
  const start = parseISO(trip.startDate);
  const end = parseISO(trip.endDate);
  if (trip.startDate === trip.endDate) return format(start, 'd MMM yyyy');
  if (format(start, 'yyyy-MM') === format(end, 'yyyy-MM')) return `${format(start, 'd')}–${format(end, 'd MMM yyyy')}`;
  if (format(start, 'yyyy') === format(end, 'yyyy')) return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`;
  return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`;
}
