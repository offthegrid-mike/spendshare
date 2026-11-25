import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TravelTile from './TravelTile';
import { makeTrip } from '../../test/fixtures';

function renderTile(trips = [makeTrip('japan', 'Japan', '2026-10-17', '2026-10-27')]) {
  return render(
    <MemoryRouter>
      <TravelTile trips={trips} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 19, 9)); // Monday 19 October 2026
});
afterEach(() => vi.useRealTimers());

describe('TravelTile', () => {
  it('shows the current trip, its dates and which day of it today is', () => {
    renderTile();
    const tile = screen.getByRole('region', { name: 'Travel' });
    expect(tile).toHaveTextContent('Japan');
    expect(tile).toHaveTextContent('17–27 Oct 2026');
    expect(tile).toHaveTextContent('Day 3 of 11');
    expect(screen.getByRole('link', { name: /Japan/ })).toHaveAttribute('href', '/travel/japan');
  });

  it('shows the next trip and how soon it starts when none is under way', () => {
    renderTile([makeTrip('nz', 'New Zealand', '2026-10-31', '2026-11-05'), makeTrip('old', 'Bali', '2026-01-01', '2026-01-10')]);
    expect(screen.getByRole('region', { name: 'Travel' })).toHaveTextContent('New Zealand');
    expect(screen.getByText('Starts in 12 days')).toBeInTheDocument();
  });

  it('says tomorrow for a trip starting tomorrow', () => {
    renderTile([makeTrip('nz', 'New Zealand', '2026-10-20', '2026-11-05')]);
    expect(screen.getByText('Starts tomorrow')).toBeInTheDocument();
  });

  it('offers to plan a trip when there is no current or upcoming one', () => {
    renderTile([makeTrip('old', 'Bali', '2026-01-01', '2026-01-10')]);
    expect(screen.getByRole('link', { name: 'Plan a trip' })).toHaveAttribute('href', '/travel/new');
    expect(screen.getByRole('link', { name: 'All trips (1)' })).toHaveAttribute('href', '/travel');
  });

  it('offers to plan a first trip with no link to an empty list', () => {
    renderTile([]);
    expect(screen.getByRole('link', { name: 'Plan a trip' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /All trips/ })).not.toBeInTheDocument();
  });
});
