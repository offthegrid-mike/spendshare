import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useWorkDays } from '../../hooks/useWorkDays';
import { useWorkSettings } from '../../hooks/useWorkSettings';
import { makeWorkDay, WORK_SETTINGS } from '../../test/fixtures';
import WorkTile from './WorkTile';

const state = vi.hoisted(() => ({
  clock: { today: '2026-10-19', nowMinutes: 540 },
  days: { days: [] as unknown[], loading: false, error: false },
  settings: { settings: null as unknown, loading: false, loaded: true },
}));

vi.mock('../../hooks/useWorkClock', () => ({ useWorkClock: () => state.clock }));
vi.mock('../../hooks/useWorkDays', () => ({ useWorkDays: vi.fn(() => state.days) }));
vi.mock('../../hooks/useWorkSettings', () => ({ useWorkSettings: vi.fn(() => state.settings) }));

// Tracking from Monday 12 October: Thursday 15 and Friday 16 are missing unless recorded.
const SETTINGS = { ...WORK_SETTINGS, trackingStartDate: '2026-10-12' };
const RECORDED_WEEK = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'].map((date) =>
  makeWorkDay(date, { type: 'office', startTime: undefined, finishTime: undefined, minutes: undefined, countedInClaim: false }),
);

function renderTile() {
  return render(
    <MemoryRouter>
      <WorkTile uid="mike" />
    </MemoryRouter>,
  );
}

function valueOf(label: string): string | null {
  const row = screen.getByText(label).closest('p') as HTMLElement;
  return row.lastElementChild?.textContent ?? null;
}

beforeEach(() => {
  state.clock = { today: '2026-10-19', nowMinutes: 540 };
  state.days = { days: RECORDED_WEEK, loading: false, error: false };
  state.settings = { settings: SETTINGS, loading: false, loaded: true };
  vi.mocked(useWorkDays).mockClear();
  vi.mocked(useWorkSettings).mockClear();
});

describe('WorkTile', () => {
  it("loads the user's settings and the days of the income year containing today", () => {
    renderTile();
    expect(useWorkSettings).toHaveBeenCalledWith('mike');
    expect(useWorkDays).toHaveBeenCalledWith('mike', '2026-27');
  });

  it('is headed by a link into Work with the income year', () => {
    renderTile();
    const tile = screen.getByRole('region', { name: 'Work' });
    const heading = within(tile).getByRole('heading', { name: 'Work' });
    expect(heading.closest('a')).toHaveAttribute('href', '/work');
    expect(within(tile).getByText('Income year 2026–27')).toBeInTheDocument();
  });

  it('offers a desktop-only link to record today', () => {
    renderTile();
    const link = screen.getByRole('link', { name: 'Record today' });
    expect(link).toHaveAttribute('href', '/work');
    expect(link).toHaveClass('hidden', 'lg:inline-flex', 'btn-outline');
  });

  it('says today is not recorded, in the warning tone', () => {
    renderTile();
    expect(valueOf('Today')).toBe('Not recorded');
    expect(screen.getByText('Not recorded')).toHaveClass('text-warning');
  });

  it("shows today's recorded Home hours", () => {
    state.days = { days: [...RECORDED_WEEK, makeWorkDay('2026-10-19', { finishConfirmed: false })], loading: false, error: false };
    renderTile();
    expect(valueOf('Today')).toBe('Home · 7.6 h');
  });

  it('shows a recorded Office day by its type', () => {
    state.days = {
      days: [...RECORDED_WEEK, makeWorkDay('2026-10-19', { type: 'office', startTime: undefined, finishTime: undefined, minutes: undefined })],
      loading: false,
      error: false,
    };
    renderTile();
    expect(valueOf('Today')).toBe('Office');
  });

  it('says a weekend is not a work day', () => {
    state.clock = { today: '2026-10-18', nowMinutes: 540 };
    renderTile();
    expect(valueOf('Today')).toBe('Not a work day');
  });

  it('counts the weekdays missing, in the warning tone when there are some', () => {
    state.days = { days: RECORDED_WEEK.slice(0, 3), loading: false, error: false };
    renderTile();
    expect(valueOf('Weekdays missing')).toBe('2');
    expect(screen.getByText('2')).toHaveClass('text-warning');
  });

  it('shows no missing weekdays in the plain tone', () => {
    renderTile();
    expect(valueOf('Weekdays missing')).toBe('0');
    expect(screen.getByText('0')).not.toHaveClass('text-warning');
  });

  it('shows the days to confirm only when there are some', () => {
    renderTile();
    expect(screen.queryByText('To confirm')).toBeNull();

    state.days = {
      days: [...RECORDED_WEEK.slice(0, 4), makeWorkDay('2026-10-16', { finishConfirmed: false })],
      loading: false,
      error: false,
    };
    renderTile();
    expect(valueOf('To confirm')).toBe('1');
  });

  it('shows the counted hours from home this income year', () => {
    const counted = Array.from({ length: 22 }, (_, i) => makeWorkDay(`2026-08-${String(i + 1).padStart(2, '0')}`));
    const late = makeWorkDay('2026-09-01', { addedLater: true, countedInClaim: false });
    state.days = { days: [...counted, late, ...RECORDED_WEEK], loading: false, error: false };
    renderTile();
    expect(valueOf('From home')).toBe('167.2 h');
  });

  it('shows the last five working days, marking today and the missing ones', () => {
    state.days = { days: RECORDED_WEEK.slice(0, 3), loading: false, error: false };
    renderTile();
    const strip = screen.getByRole('list', { name: 'Recent working days' });
    const chips = within(strip).getAllByRole('listitem');
    expect(chips).toHaveLength(5);
    expect(chips.map((chip) => chip.textContent)).toEqual([
      'Tue 13Office',
      'Wed 14Office',
      'Thu 15Missing',
      'Fri 16Missing',
      'Mon 19Not yet',
    ]);
    expect(chips[4]).toHaveAttribute('aria-current', 'date');
    expect(chips.slice(0, 4).every((chip) => !chip.hasAttribute('aria-current'))).toBe(true);
    expect(chips[2]).toHaveClass('border-dotted', 'border-warning');
  });

  it('shows a dash for a day it cannot judge', () => {
    state.settings = { settings: { ...SETTINGS, trackingStartDate: null }, loading: false, loaded: true };
    state.days = { days: [], loading: false, error: false };
    renderTile();
    const chips = within(screen.getByRole('list', { name: 'Recent working days' })).getAllByRole('listitem');
    expect(chips[0]).toHaveTextContent('—');
    expect(valueOf('Weekdays missing')).toBe('0');
  });

  it('shows placeholders, not zeros, while loading', () => {
    state.days = { days: [], loading: true, error: false };
    renderTile();
    expect(screen.getByRole('status', { name: 'Loading figures' })).toBeInTheDocument();
    expect(screen.queryByText('Weekdays missing')).toBeNull();
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByText('Not recorded')).toBeNull();
  });

  it('waits for the settings too', () => {
    state.settings = { settings: SETTINGS, loading: true, loaded: false };
    renderTile();
    expect(screen.getByRole('status', { name: 'Loading figures' })).toBeInTheDocument();
  });

  it('says the days failed to load instead of showing zeros', () => {
    state.days = { days: [], loading: false, error: true };
    renderTile();
    expect(screen.getByText("Couldn't load your Work days.")).toBeInTheDocument();
    expect(screen.queryByText('Weekdays missing')).toBeNull();
  });
});
