import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the uiStore so we control selectedMonth
const { useUIStore } = vi.hoisted(() => ({ useUIStore: vi.fn() }));
vi.mock('../src/stores/uiStore', () => ({ useUIStore }));

import MonthControl from '../src/components/MonthControl';

function optionValues() {
  const select = screen.getByRole('combobox', { name: /month/i });
  return within(select).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
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
    const select = screen.getByRole('combobox', { name: /month/i });
    expect((select as HTMLSelectElement).selectedOptions[0].textContent).toBe('June 2026');
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
    expect(optionValues()).toEqual(['2026-06', '2026-05', '2026-04', '2026-03']);
  });

  it('calls setMonth when a month is picked from the list', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    useUIStore.mockReturnValue({ selectedMonth: '2026-06', setMonth });
    const u = userEvent.setup();
    render(<MonthControl startMonth="2026-03" />);
    await u.selectOptions(screen.getByRole('combobox', { name: /month/i }), '2026-04');
    expect(setMonth).toHaveBeenCalledWith('2026-04');
  });

  it('still lists the selected month when it is before the start month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    useUIStore.mockReturnValue({ selectedMonth: '2026-01', setMonth });
    render(<MonthControl startMonth="2026-04" />);
    expect(optionValues()).toEqual([
      '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01',
    ]);
    const select = screen.getByRole('combobox', { name: /month/i }) as HTMLSelectElement;
    expect(select.value).toBe('2026-01');
  });

  it('lists the selected month up to now when there is no start month yet', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    useUIStore.mockReturnValue({ selectedMonth: '2026-05', setMonth });
    render(<MonthControl startMonth={null} />);
    expect(optionValues()).toEqual(['2026-06', '2026-05']);
  });
});

describe('MonthControl focus', () => {
  it('shows a focus ring around the month label when its hidden select has focus', () => {
    useUIStore.mockReturnValue({ selectedMonth: '2026-05', setMonth: vi.fn() });
    render(<MonthControl />);
    const label = screen.getByRole('combobox', { name: 'Month' }).parentElement!;
    expect(label.className).toMatch(/focus-within:ring-2/);
  });
});
