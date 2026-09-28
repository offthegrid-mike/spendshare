import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DatePicker from './DatePicker';

// Uses the real react-day-picker to verify month/year jumping.
describe('DatePicker month/year navigation', () => {
  async function open(value: string) {
    const onChange = vi.fn();
    const u = userEvent.setup();
    render(<DatePicker id="dp" value={value} onChange={onChange} />);
    await u.click(screen.getByRole('button', { name: /^Date:/ }));
    return { u, onChange };
  }

  it('offers month and year dropdowns showing the selected date', async () => {
    await open('2026-09-28');
    expect(screen.getByRole('combobox', { name: /month/i })).toHaveDisplayValue(/sep/i);
    expect(screen.getByRole('combobox', { name: /year/i })).toHaveDisplayValue('2026');
  });

  it('jumps straight to another month and year and selects a day there', async () => {
    const { u, onChange } = await open('2026-09-28');

    await u.selectOptions(screen.getByRole('combobox', { name: /year/i }), '2024');
    await u.selectOptions(screen.getByRole('combobox', { name: /month/i }), '2');
    await u.click(screen.getByRole('button', { name: /March 15th, 2024/i }));

    expect(onChange).toHaveBeenCalledWith('2024-03-15');
  });

  it('includes the selected year in the year range even when it is far in the past', async () => {
    await open('1999-05-10');
    expect(screen.getByRole('combobox', { name: /year/i })).toHaveDisplayValue('1999');
  });
});
