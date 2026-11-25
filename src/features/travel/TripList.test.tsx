import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { User } from 'firebase/auth';
import TripList from './TripList';
import { makeTrip } from '../../test/fixtures';

vi.mock('../invites/PendingInvites', () => ({ default: () => <div data-testid="pending-invites" /> }));

const user = { uid: 'mike', email: 'mike@example.com' } as User;

function renderList(trips = [
  makeTrip('old', 'Bali', '2026-01-01', '2026-01-10'),
  makeTrip('nz', 'New Zealand', '2026-12-01', '2026-12-05'),
  makeTrip('japan', 'Japan', '2026-10-17', '2026-10-27', ['Mike', 'Priya', 'Sam']),
]) {
  return render(
    <MemoryRouter>
      <TripList trips={trips} user={user} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 19, 9)); // 19 October 2026
});
afterEach(() => vi.useRealTimers());

describe('TripList', () => {
  it('groups trips under Now, Upcoming and Past', () => {
    renderList();
    const now = screen.getByRole('region', { name: 'Now' });
    const upcoming = screen.getByRole('region', { name: 'Upcoming' });
    const past = screen.getByRole('region', { name: 'Past' });
    expect(within(now).getByRole('link', { name: /Japan/ })).toHaveAttribute('href', '/travel/japan');
    expect(within(now).getByText('Day 3 of 11 · 3 people')).toBeInTheDocument();
    expect(within(upcoming).getByText('Starts in 43 days · 2 people')).toBeInTheDocument();
    expect(within(past).getByText('10 days · 2 people')).toBeInTheDocument();
  });

  it('leaves out an empty section', () => {
    renderList([makeTrip('nz', 'New Zealand', '2026-12-01', '2026-12-05')]);
    expect(screen.queryByRole('region', { name: 'Now' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Past' })).not.toBeInTheDocument();
  });

  it('has a way to start a new trip, and an empty state', () => {
    renderList([]);
    expect(screen.getByText('No trips yet')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'New trip' })[0]).toHaveAttribute('href', '/travel/new');
  });

  it('shows pending invites, so a trip invite can be accepted here', () => {
    renderList([]);
    expect(screen.getByTestId('pending-invites')).toBeInTheDocument();
  });
});
