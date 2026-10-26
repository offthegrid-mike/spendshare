import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import BudgetsCard from './BudgetsCard';
import { formatMoney } from '../../lib/money';
import type { BudgetRow } from '../../lib/budget';

const money = (cents: number) => formatMoney(cents, 'AUD');

const row = (over: Partial<BudgetRow> = {}): BudgetRow => ({
  categoryId: 'groceries', name: 'Groceries', spent: 20000, limit: 50000, remaining: 30000, pct: 40, status: 'ok', ...over,
});

function renderCard(rows: BudgetRow[], pace: number | null = null, daysLeft = 0) {
  return render(<BudgetsCard rows={rows} pace={pace} daysLeft={daysLeft} currency="AUD" />);
}

describe('BudgetsCard', () => {
  it('renders nothing when no category has a budget', () => {
    const { container } = renderCard([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows each budget with what was spent of the limit, and what is left', () => {
    renderCard([row()]);
    expect(screen.getByRole('heading', { name: 'Budgets' })).toBeInTheDocument();
    const item = screen.getByTestId('budget-row');
    expect(within(item).getByText('Groceries')).toBeInTheDocument();
    expect(item).toHaveTextContent(`${money(20000)} of ${money(50000)}`);
    expect(item).toHaveTextContent(`${money(30000)} left`);
    expect(item).toHaveTextContent('40%');
  });

  it('says how far over a budget that has been passed', () => {
    renderCard([row({ spent: 25000, limit: 20000, remaining: -5000, pct: 125, status: 'over' })]);
    const item = screen.getByTestId('budget-row');
    expect(item).toHaveTextContent(`${money(5000)} over`);
    expect(item).toHaveTextContent('125%');
    expect(item).not.toHaveTextContent('left');
  });

  it('shows the percent rounded down, so it agrees with the colour', () => {
    renderCard([
      row({ categoryId: 'a', name: 'Calm', pct: 79.6, status: 'ok' }),
      row({ categoryId: 'b', name: 'Close', pct: 99.6, status: 'warn', spent: 49800, remaining: 200 }),
    ]);
    const [calm, close] = screen.getAllByTestId('budget-row');
    expect(calm).toHaveTextContent('79%');
    expect(close).toHaveTextContent('99%');
  });

  it('says a budget is fully used when it is spent to the cent', () => {
    renderCard([row({ spent: 50000, remaining: 0, pct: 100, status: 'over' })]);
    expect(screen.getByTestId('budget-row')).toHaveTextContent('Fully used');
  });

  it('exposes the progress to assistive tech, capped at 100%', () => {
    renderCard([row({ spent: 25000, limit: 20000, remaining: -5000, pct: 125, status: 'over' })]);
    const bar = screen.getByRole('progressbar', { name: 'Groceries budget' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('colours the bar by status: accent, amber from 80%, red once over', () => {
    renderCard([
      row({ categoryId: 'a', name: 'Calm', pct: 40, status: 'ok' }),
      row({ categoryId: 'b', name: 'Close', pct: 85, status: 'warn', spent: 42500, remaining: 7500 }),
      row({ categoryId: 'c', name: 'Past', pct: 110, status: 'over', spent: 55000, remaining: -5000 }),
    ]);
    const bars = screen.getAllByTestId('budget-bar');
    expect(bars[0]).toHaveClass('bg-accent');
    expect(bars[1]).toHaveClass('bg-warning');
    expect(bars[2]).toHaveClass('bg-negative');
  });

  it('sizes the bar to the share used, capped at the full track', () => {
    renderCard([row({ categoryId: 'a', pct: 40 }), row({ categoryId: 'b', name: 'Past', pct: 130, status: 'over' })]);
    const bars = screen.getAllByTestId('budget-bar');
    expect(bars[0]).toHaveStyle({ width: '40%' });
    expect(bars[1]).toHaveStyle({ width: '100%' });
  });

  it('draws an empty bar when refunds have outweighed spending', () => {
    renderCard([row({ spent: -3000, remaining: 53000, pct: 0 })]);
    expect(screen.getByTestId('budget-bar')).toHaveStyle({ width: '0%' });
    expect(screen.getByTestId('budget-row')).toHaveTextContent(`${money(53000)} left`);
  });

  it('marks the pace of the month in progress on each bar, and says how many days are left', () => {
    renderCard([row({ categoryId: 'a' }), row({ categoryId: 'b', name: 'Dining' })], 61.29, 12);
    const ticks = screen.getAllByTestId('budget-pace');
    expect(ticks).toHaveLength(2);
    expect(ticks[0]).toHaveStyle({ left: '61.29%' });
    expect(screen.getByText('12 days left')).toBeInTheDocument();
    expect(screen.getByText(/line marks an even pace/i)).toBeInTheDocument();
  });

  it('says "1 day left" in the singular', () => {
    renderCard([row()], 96.7, 1);
    expect(screen.getByText('1 day left')).toBeInTheDocument();
  });

  it('shows no pace line or days left for a month that is over or not started', () => {
    renderCard([row()], null, 0);
    expect(screen.queryByTestId('budget-pace')).not.toBeInTheDocument();
    expect(screen.queryByText(/days? left$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/even pace/i)).not.toBeInTheDocument();
  });
});
