import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import CategoryBreakdown from './CategoryBreakdown';
import type { MonthCategory } from '../../lib/monthSummary';

const categories: MonthCategory[] = [
  { category: 'Groceries', amount: 9000, pct: 75, change: 50 },
  { category: 'Dining', amount: 2000, pct: 16.67, change: -50 },
  { category: 'Household', amount: 1000, pct: 8.33, change: 'new' },
];

function renderCategories(list = categories, comparedWith = 'September') {
  return render(<CategoryBreakdown categories={list} currency="AUD" comparedWith={comparedWith} />);
}

describe('CategoryBreakdown', () => {
  it('lists each category with its amount and rounded share, in the order given', () => {
    renderCategories();
    expect(screen.getByRole('heading', { name: 'By category' })).toBeInTheDocument();
    const rows = screen.getAllByTestId('category-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Groceries');
    expect(rows[0]).toHaveTextContent('A$90.00');
    expect(rows[0]).toHaveTextContent('75%');
    expect(rows[1]).toHaveTextContent('Dining');
    expect(rows[1]).toHaveTextContent('17%');
  });

  it('sizes each bar to the category’s share', () => {
    renderCategories();
    const bars = screen.getAllByTestId('category-bar');
    expect(bars[0]).toHaveStyle({ width: '75%' });
    expect(bars[2]).toHaveStyle({ width: '8.33%' });
  });

  it('marks a rise, a fall and a new category against last month', () => {
    renderCategories();
    const [groceries, dining, household] = screen.getAllByTestId('category-row');
    expect(within(groceries).getByLabelText('Up 50% from September')).toBeInTheDocument();
    expect(within(dining).getByLabelText('Down 50% from September')).toBeInTheDocument();
    expect(within(household).getByText('New')).toBeInTheDocument();
  });

  it('shows no mark without a comparison, or when the change rounds to nothing', () => {
    renderCategories([
      { category: 'Groceries', amount: 9000, pct: 90, change: null },
      { category: 'Dining', amount: 1000, pct: 10, change: 0.3 },
    ]);
    expect(screen.queryByLabelText(/from September/)).toBeNull();
    expect(screen.queryByText('New')).toBeNull();
  });

  it('renders nothing without categories', () => {
    const { container } = renderCategories([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the days of last month a month in progress is compared with', () => {
    renderCategories(categories, '1–12 September');
    expect(screen.getByLabelText('Up 50% from 1–12 September')).toBeInTheDocument();
    expect(screen.getByLabelText('Down 50% from 1–12 September')).toBeInTheDocument();
  });

  it('says in plain view what the changes are measured against', () => {
    renderCategories(categories, '1–12 September');
    expect(screen.getByText('Change vs 1–12 September')).toBeInTheDocument();
  });

  it('names the whole month when that is what is compared', () => {
    renderCategories();
    expect(screen.getByText('Change vs September')).toBeInTheDocument();
  });

  it('leaves the comparison note out when there is nothing to compare', () => {
    renderCategories([{ category: 'Groceries', amount: 9000, pct: 100, change: null }]);
    expect(screen.queryByText(/Change vs/)).toBeNull();
  });
});
