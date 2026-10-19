import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { MonthTotal } from '../../lib/work/workYear';
import MonthlyTotals from './MonthlyTotals';

const TOTALS: MonthTotal[] = [
  { month: '2026-07', homeDays: 3, countedMinutes: 912, officeDays: 2, leaveDays: 0 },
  { month: '2026-08', homeDays: 1, countedMinutes: 470, officeDays: 0, leaveDays: 1 },
];

describe('MonthlyTotals', () => {
  it('has a row per month with its counted hours and its days by type', () => {
    render(<MonthlyTotals totals={TOTALS} />);
    const table = screen.getByRole('table', { name: 'Totals per month' });
    const headers = within(table).getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers).toEqual(['Month', 'Counted hours', 'Home days', 'Office', 'Leave']);

    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))).toEqual([
      ['July', '15.2', '3', '2', '0'],
      ['August', '7.83', '1', '0', '1'],
    ]);
  });

  it('renders nothing for no months', () => {
    const { container } = render(<MonthlyTotals totals={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
