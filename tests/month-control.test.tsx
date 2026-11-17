import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the uiStore so we control selectedMonth
const { useUIStore } = vi.hoisted(() => ({ useUIStore: vi.fn() }));
vi.mock('../src/stores/uiStore', () => ({ useUIStore }));

import MonthControl from '../src/components/MonthControl';

const trigger = () => screen.getByRole('combobox', { name: /month/i });

/** Opens the month list and returns what it offers, in order. */
function optionLabels() {
  // fireEvent, not userEvent: these tests freeze the clock with fake timers.
  fireEvent.click(trigger());
  return within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent);
}

describe('MonthControl', () => {
  const setMonth = vi.fn();

  beforeEach(() => {
    setMonth.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a human-readable label for the selected month', () => {
    useUIStore.mockReturnValue({ selectedMonth: '2026-06', setMonth });
    render(<MonthControl />);
    expect(trigger()).toHaveTextContent('June 2026');
  });

  it('calls setMonth with the previous month when Previous is clicked', async () => {
    useUIStore.mockReturnValue({ selectedMonth: '2026-06', setMonth });
    const u = userEvent.setup();
    render(<MonthControl />);
    await u.click(screen.getByRole('button', { name: 'Previous' }));
    expect(setMonth).toHaveBeenCalledWith('2026-05');
  });

  it('calls setMonth with the next month when Next is clicked for a past month', async () => {
    useUIStore.mockReturnValue({ selectedMonth: '2026-05', setMonth });
    const u = userEvent.setup();
    render(<MonthControl />);
    await u.click(screen.getByRole('button', { name: 'Next' }));
    expect(setMonth).toHaveBeenCalledWith('2026-06');
  });

  it('disables Next on the current month', () => {
    // Fake timers freeze Date.now(), which the component uses for the current month.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    useUIStore.mockReturnValue({ selectedMonth: '2026-06', setMonth });
    render(<MonthControl />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('lists months from the start month to the current month, newest first', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    useUIStore.mockReturnValue({ selectedMonth: '2026-05', setMonth });
    render(<MonthControl startMonth="2026-03" />);
    expect(optionLabels()).toEqual(['June 2026', 'May 2026', 'April 2026', 'March 2026']);
  });

  it('calls setMonth when a month is picked from the list', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    useUIStore.mockReturnValue({ selectedMonth: '2026-06', setMonth });
    const u = userEvent.setup();
    render(<MonthControl startMonth="2026-03" />);
    await u.click(trigger());
    await u.click(screen.getByRole('option', { name: 'April 2026' }));
    expect(setMonth).toHaveBeenCalledWith('2026-04');
  });

  it('still lists the selected month when it is before the start month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    useUIStore.mockReturnValue({ selectedMonth: '2026-01', setMonth });
    render(<MonthControl startMonth="2026-04" />);
    expect(optionLabels()).toEqual([
      'June 2026', 'May 2026', 'April 2026', 'March 2026', 'February 2026', 'January 2026',
    ]);
    expect(screen.getByRole('option', { name: 'January 2026' })).toHaveAttribute('aria-selected', 'true');
  });

  it('lists the selected month up to now when there is no start month yet', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    useUIStore.mockReturnValue({ selectedMonth: '2026-05', setMonth });
    render(<MonthControl startMonth={null} />);
    expect(optionLabels()).toEqual(['June 2026', 'May 2026']);
  });
});

describe('MonthControl look', () => {
  it('is a themed button, not a native select', () => {
    useUIStore.mockReturnValue({ selectedMonth: '2026-05', setMonth: vi.fn() });
    const { container } = render(<MonthControl />);
    expect(container.querySelector('select')).toBeNull();
    expect(trigger().tagName).toBe('BUTTON');
    expect(trigger().className).toMatch(/focus-visible:ring-2/);
  });
});
