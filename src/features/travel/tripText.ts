import type { TripProgress } from '../../lib/travel/trips';

/** "Day 3 of 11", "Starts tomorrow", "Starts in 12 days", or a past trip's length, "10 days". */
export function progressText(p: TripProgress): string {
  if (p.status === 'current') return `Day ${p.day} of ${p.length}`;
  if (p.status === 'upcoming') return p.daysUntil === 1 ? 'Starts tomorrow' : `Starts in ${p.daysUntil} days`;
  return p.length === 1 ? '1 day' : `${p.length} days`;
}

export function peopleText(count: number): string {
  return count === 1 ? '1 person' : `${count} people`;
}
