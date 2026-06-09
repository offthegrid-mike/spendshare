import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the uiStore so we control selectedMonth
const { useUIStore } = vi.hoisted(() => ({ useUIStore: vi.fn() }));
vi.mock('../src/stores/uiStore', () => ({ useUIStore }));

import MonthPicker from '../src/components/MonthPicker';

describe('MonthPicker', () => {
  const setMonth = vi.fn();

  beforeEach(() => {
    setMonth.mockReset();
  });

  it('renders a human-readable month label for 2026-06', () => {
    useUIStore.mockReturnValue({ selectedMonth: '2026-06', setMonth });

    render(<MonthPicker />);

    expect(screen.getByText(/June 2026/i)).toBeInTheDocument();
  });

  it('calls setMonth with the previous month when the Previous button is clicked', async () => {
    useUIStore.mockReturnValue({ selectedMonth: '2026-06', setMonth });

    const u = userEvent.setup();
    render(<MonthPicker />);

    // Accept either "←" or a button with accessible name "Previous"
    const prevBtn =
      screen.queryByRole('button', { name: /previous/i }) ??
      screen.getByRole('button', { name: /←/ });
    await u.click(prevBtn);

    expect(setMonth).toHaveBeenCalledWith('2026-05');
  });

  it('calls setMonth with the next month when the Next button is clicked for a past month', async () => {
    useUIStore.mockReturnValue({ selectedMonth: '2026-05', setMonth });

    const u = userEvent.setup();
    render(<MonthPicker />);

    const nextBtn =
      screen.queryByRole('button', { name: /next/i }) ??
      screen.getByRole('button', { name: /→/ });
    await u.click(nextBtn);

    expect(setMonth).toHaveBeenCalledWith('2026-06');
  });

  it('disables the Next button when selectedMonth equals the current month', () => {
    // Use a fixed "current" month that is the same as selectedMonth.
    // We freeze Date so monthKey() inside the component returns '2026-06'.
    const RealDate = Date;
    vi.spyOn(globalThis, 'Date').mockImplementation((...args: unknown[]) => {
      if (args.length === 0) return new RealDate('2026-06-08T12:00:00Z');
      // @ts-expect-error forwarding args
      return new RealDate(...args);
    });

    useUIStore.mockReturnValue({ selectedMonth: '2026-06', setMonth });

    render(<MonthPicker />);

    // The Next button should be disabled (or not rendered) when on the current month
    const nextBtn =
      screen.queryByRole('button', { name: /next/i }) ??
      screen.queryByRole('button', { name: /→/ });

    if (nextBtn) {
      expect(nextBtn).toBeDisabled();
    } else {
      // Acceptable alternative: the button is simply not rendered
      expect(nextBtn).toBeNull();
    }

    vi.restoreAllMocks();
  });
});
