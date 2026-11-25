import { describe, it, expect } from 'vitest';
import {
  isTrip, splitGroups, tripStatus, tripProgress, sortTrips, featuredTrip, validateTripInput, formatTripDates,
} from './trips';
import type { GroupDoc } from '../../types/models';

function group(id: string, extra: Partial<GroupDoc> = {}): GroupDoc {
  return { id, name: id, currency: 'AUD', ownerUid: 'u', members: {}, memberUids: ['u'], createdAt: null as never, ...extra };
}
function trip(id: string, startDate: string, endDate: string): GroupDoc {
  return group(id, { kind: 'trip', trip: { startDate, endDate } });
}

describe('isTrip and splitGroups', () => {
  it('tells trips from households, keeping order', () => {
    const home = group('home');
    const japan = trip('japan', '2027-05-10', '2027-05-20');
    const flat = group('flat');
    expect(isTrip(japan)).toBe(true);
    expect(isTrip(home)).toBe(false);
    expect(splitGroups([home, japan, flat])).toEqual({ households: [home, flat], trips: [japan] });
  });

  it('treats a trip-kind group without dates as a trip', () => {
    expect(isTrip(group('odd', { kind: 'trip' }))).toBe(true);
  });
});

describe('tripStatus', () => {
  const t = { startDate: '2027-05-10', endDate: '2027-05-20' };
  it('is upcoming before the first day, current on the first and last days, past after', () => {
    expect(tripStatus(t, '2027-05-09')).toBe('upcoming');
    expect(tripStatus(t, '2027-05-10')).toBe('current');
    expect(tripStatus(t, '2027-05-20')).toBe('current');
    expect(tripStatus(t, '2027-05-21')).toBe('past');
  });
});

describe('tripProgress', () => {
  const t = { startDate: '2027-05-10', endDate: '2027-05-20' };
  it('counts days until an upcoming trip', () => {
    expect(tripProgress(t, '2027-05-07')).toEqual({ status: 'upcoming', daysUntil: 3, length: 11 });
  });
  it('gives the day number during a trip, counting the first day as day 1', () => {
    expect(tripProgress(t, '2027-05-10')).toEqual({ status: 'current', day: 1, length: 11 });
    expect(tripProgress(t, '2027-05-20')).toEqual({ status: 'current', day: 11, length: 11 });
  });
  it('counts across a month and year end', () => {
    expect(tripProgress({ startDate: '2026-12-30', endDate: '2027-01-02' }, '2027-01-01'))
      .toEqual({ status: 'current', day: 3, length: 4 });
  });
  it('just gives the length for a past trip', () => {
    expect(tripProgress(t, '2027-06-01')).toEqual({ status: 'past', length: 11 });
  });
});

describe('sortTrips and featuredTrip', () => {
  const today = '2027-05-15';
  const now = trip('now', '2027-05-10', '2027-05-20');
  const soon = trip('soon', '2027-06-01', '2027-06-05');
  const later = trip('later', '2027-09-01', '2027-09-05');
  const lastYear = trip('lastYear', '2026-05-01', '2026-05-05');
  const lastMonth = trip('lastMonth', '2027-04-01', '2027-04-05');

  it('puts current trips first, then upcoming soonest first, then past most recent first', () => {
    const sorted = sortTrips([lastYear, later, lastMonth, soon, now], today);
    expect(sorted.map((t) => t.id)).toEqual(['now', 'soon', 'later', 'lastMonth', 'lastYear']);
  });

  it('features the current trip, else the next one, else none', () => {
    expect(featuredTrip([soon, now, lastMonth], today)?.id).toBe('now');
    expect(featuredTrip([later, soon, lastMonth], today)?.id).toBe('soon');
    expect(featuredTrip([lastMonth], today)).toBeNull();
    expect(featuredTrip([], today)).toBeNull();
  });

  it('skips a trip without dates instead of failing', () => {
    expect(sortTrips([group('odd', { kind: 'trip' }), now], today).map((t) => t.id)).toEqual(['now', 'odd']);
    expect(featuredTrip([group('odd', { kind: 'trip' })], today)).toBeNull();
  });
});

describe('validateTripInput', () => {
  const ok = { name: 'Japan', startDate: '2027-05-10', endDate: '2027-05-20' };
  it('accepts a named trip whose end is on or after its start', () => {
    expect(validateTripInput(ok)).toBeNull();
    expect(validateTripInput({ ...ok, endDate: ok.startDate })).toBeNull();
  });
  it('explains what is wrong', () => {
    expect(validateTripInput({ ...ok, name: '  ' })).toBe('Enter a trip name.');
    expect(validateTripInput({ ...ok, startDate: '' })).toBe('Choose the first day of the trip.');
    expect(validateTripInput({ ...ok, endDate: '' })).toBe('Choose the last day of the trip.');
    expect(validateTripInput({ ...ok, endDate: '2027-05-09' })).toBe('The last day can’t be before the first.');
  });
});

describe('formatTripDates', () => {
  it('shortens a range within one month or one year', () => {
    expect(formatTripDates({ startDate: '2027-05-10', endDate: '2027-05-20' })).toBe('10–20 May 2027');
    expect(formatTripDates({ startDate: '2027-05-28', endDate: '2027-06-03' })).toBe('28 May – 3 Jun 2027');
    expect(formatTripDates({ startDate: '2026-12-28', endDate: '2027-01-03' })).toBe('28 Dec 2026 – 3 Jan 2027');
  });
  it('shows a one-day trip as one date', () => {
    expect(formatTripDates({ startDate: '2027-05-10', endDate: '2027-05-10' })).toBe('10 May 2027');
  });
});
