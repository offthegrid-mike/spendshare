import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DatePicker from './DatePicker';

// Uses the real react-day-picker to verify month/year jumping.
describe('DatePicker month/year navigation', () => {
  async function open(value: string) {
    const onChange = vi.fn();
    const u = userEvent.setup();
    const { container } = render(<DatePicker id="dp" value={value} onChange={onChange} />);
    await u.click(screen.getByRole('button', { name: /^Date:/ }));
    return { u, onChange, container };
  }

  it('shows the selected month and never uses native dropdowns', async () => {
    await open('2026-09-28');
    expect(screen.getByRole('button', { name: 'Choose month and year' })).toHaveTextContent('September 2026');
    expect(document.querySelector('select')).toBeNull();
  });

  it('steps to the neighbouring month with the arrows', async () => {
    const { u, onChange } = await open('2026-09-28');
    await u.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('button', { name: 'Choose month and year' })).toHaveTextContent('August 2026');
    await u.click(screen.getByRole('button', { name: /August 5th, 2026/i }));
    expect(onChange).toHaveBeenCalledWith('2026-08-05');
  });

  it('jumps straight to another month and year and selects a day there', async () => {
    const { u, onChange } = await open('2026-09-28');

    await u.click(screen.getByRole('button', { name: 'Choose month and year' }));
    await u.click(screen.getByRole('button', { name: 'Previous year' }));
    await u.click(screen.getByRole('button', { name: 'Previous year' }));
    await u.click(screen.getByRole('button', { name: 'Mar' }));
    await u.click(screen.getByRole('button', { name: /March 15th, 2024/i }));

    expect(onChange).toHaveBeenCalledWith('2024-03-15');
  });

  it('reaches a selected year far in the past', async () => {
    await open('1999-05-10');
    expect(screen.getByRole('button', { name: 'Choose month and year' })).toHaveTextContent('May 1999');
  });

  it('stops the year arrows at the edge of the range', async () => {
    const { u } = await open('2026-09-28');
    await u.click(screen.getByRole('button', { name: 'Choose month and year' }));
    const thisYear = new Date().getFullYear();
    for (let i = 0; i < 40; i++) {
      const prev = screen.getByRole('button', { name: 'Previous year' });
      if ((prev as HTMLButtonElement).disabled) break;
      await u.click(prev);
    }
    expect(screen.getByRole('button', { name: 'Previous year' })).toBeDisabled();
    expect(Number(screen.getByRole('button', { name: 'Choose month and year' }).textContent)).toBeLessThanOrEqual(thisYear - 10);
  });
});
