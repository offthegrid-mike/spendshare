import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Stub DayPicker so tests focus on wrapper behaviour only.
vi.mock('react-day-picker', () => ({
  DayPicker: ({ onSelect }: { onSelect: (d: Date) => void }) => (
    <button
      data-testid="mock-calendar"
      onClick={() => onSelect(new Date('2026-06-20'))}
    >
      calendar
    </button>
  ),
}));

import DatePicker from './DatePicker';

describe('DatePicker', () => {
  it('displays the formatted date when a value is provided', () => {
    render(<DatePicker id="dp" value="2026-06-15" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Jun 15, 2026/i })).toBeInTheDocument();
  });

  it('shows a placeholder when no value is provided', () => {
    render(<DatePicker id="dp" value="" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /pick a date/i })).toBeInTheDocument();
  });

  it('toggles the calendar open when the trigger is clicked', async () => {
    const u = userEvent.setup();
    render(<DatePicker id="dp" value="2026-06-15" onChange={vi.fn()} />);

    expect(screen.queryByTestId('mock-calendar')).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: /Jun 15, 2026/i }));
    expect(screen.getByTestId('mock-calendar')).toBeInTheDocument();
  });

  it('calls onChange with YYYY-MM-DD when a date is selected', async () => {
    const onChange = vi.fn();
    const u = userEvent.setup();
    render(<DatePicker id="dp" value="2026-06-15" onChange={onChange} />);

    await u.click(screen.getByRole('button', { name: /Jun 15, 2026/i }));
    await u.click(screen.getByTestId('mock-calendar'));

    expect(onChange).toHaveBeenCalledWith('2026-06-20');
  });

  it('closes the calendar after a date is selected', async () => {
    const u = userEvent.setup();
    render(<DatePicker id="dp" value="2026-06-15" onChange={vi.fn()} />);

    await u.click(screen.getByRole('button', { name: /Jun 15, 2026/i }));
    await u.click(screen.getByTestId('mock-calendar'));

    expect(screen.queryByTestId('mock-calendar')).not.toBeInTheDocument();
  });

  it('renders an error message when error prop is provided', () => {
    render(<DatePicker id="dp" value="" onChange={vi.fn()} error="Date required" />);
    expect(screen.getByText(/date required/i)).toBeInTheDocument();
  });
});
