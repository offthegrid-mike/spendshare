import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TripScreen from './TripScreen';
import { makeTrip } from '../../test/fixtures';

const japan = makeTrip('japan', 'Japan', '2026-10-17', '2026-10-27', ['Mike', 'Priya', 'Sam']);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/travel/:tripId" element={<TripScreen trips={[japan]} viewerUid="mike" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 19, 9)); // 19 October 2026
});
afterEach(() => vi.useRealTimers());

describe('TripScreen', () => {
  it('shows the trip, its dates, progress and who is going', () => {
    renderAt('/travel/japan');
    expect(screen.getByRole('heading', { name: 'Japan' })).toBeInTheDocument();
    expect(screen.getByText('17–27 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('Day 3 of 11')).toBeInTheDocument();
    const going = within(screen.getByRole('list', { name: 'Who’s going' }));
    expect(going.getAllByRole('listitem')).toHaveLength(3);
    expect(going.getByText('Mike (you)')).toBeInTheDocument();
    expect(going.getByText('Priya')).toBeInTheDocument();
    expect(screen.getByText('Home currency: AUD')).toBeInTheDocument();
  });

  it('links to the trip settings for members and invites', () => {
    renderAt('/travel/japan');
    expect(screen.getByRole('link', { name: 'Members and settings' })).toHaveAttribute('href', '/travel/japan/settings');
  });

  it('says so for a trip the user is not on, with a way back', () => {
    renderAt('/travel/nope');
    expect(screen.getByText('Trip not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All trips' })).toHaveAttribute('href', '/travel');
  });
});
