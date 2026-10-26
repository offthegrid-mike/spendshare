import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PriceScreen from './PriceScreen';
import { makeExpense, makeGroup, makeItem } from '../../test/fixtures';
import { paths } from '../../lib/paths';
import type { ExpenseDoc, ItemDoc } from '../../types/models';

const { history } = vi.hoisted(() => ({
  history: {
    expenses: [] as ExpenseDoc[],
    itemsByExpense: {} as Record<string, ItemDoc[]>,
    loading: false,
    error: null as string | null,
  },
}));
vi.mock('../../hooks/useAllExpenses', () => ({ useAllExpenses: () => history }));
vi.mock('../../components/AppSkeletons', () => ({ RouteSkeleton: () => <p>Loading</p> }));
vi.mock('./PriceChart', () => ({
  default: ({ series, currency }: { series: { shop: string }[]; currency: string }) => (
    <div data-testid="price-chart" data-shops={series.map((s) => s.shop).join(',')} data-currency={currency} />
  ),
}));

const group = makeGroup('g1', 'Home');

/** Milk 2L bought four times at two shops, newest last; a milk-free expense and a refund as noise. */
function stock(purchases: [id: string, day: string, shop: string, unit: number][]) {
  history.expenses = purchases.map(([id, day, shop]) => makeExpense(id, { day, shopName: shop }));
  history.itemsByExpense = Object.fromEntries(
    purchases.map(([id, , , unit]) => [id, [makeItem(`${id}-i`, id, { name: 'Milk 2L', amount: unit })]]),
  );
}

beforeEach(() => {
  stock([
    ['e1', '2026-04-12', 'Coles', 310],
    ['e2', '2026-09-20', 'Coles', 340],
    ['e3', '2026-10-05', 'Aldi', 290],
    ['e4', '2026-10-12', 'Coles', 360],
  ]);
  history.loading = false;
  history.error = null;
});

const renderScreen = (name = 'milk 2l') => render(<MemoryRouter><PriceScreen group={group} name={name} /></MemoryRouter>);
/** The item's name and latest price, apart from the lists that repeat prices below. */
const header = () => within(screen.getByRole('heading', { level: 2 }).parentElement as HTMLElement);

describe('PriceScreen', () => {
  it('names the item as it was last written, with its latest price, shop and day', () => {
    renderScreen();
    expect(screen.getByRole('heading', { level: 2, name: 'Milk 2L' })).toBeInTheDocument();
    expect(header().getByText('A$3.60')).toBeInTheDocument();
    expect(header().getByText('at Coles, 12 Oct')).toBeInTheDocument();
  });

  it('says how the price has moved over 6 and 12 months, where there is history that old', () => {
    renderScreen();
    const changes = screen.getByRole('list', { name: 'Price change' });
    expect(within(changes).getAllByRole('listitem')).toHaveLength(1);
    expect(changes).toHaveTextContent('Up 16.1%');
    expect(changes).toHaveTextContent('vs 6 months ago');
    expect(changes).toHaveTextContent('from A$3.10 on 12 Apr');
  });

  it('shows both horizons when there is history for both', () => {
    stock([['a', '2025-09-01', 'Coles', 300], ['b', '2026-03-01', 'Coles', 330], ['c', '2026-10-01', 'Coles', 360]]);
    renderScreen();
    const rows = within(screen.getByRole('list', { name: 'Price change' })).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('vs 6 months ago');
    expect(rows[0]).toHaveTextContent('Up 9.1%');
    expect(rows[1]).toHaveTextContent('vs 12 months ago');
    expect(rows[1]).toHaveTextContent('Up 20.0%');
  });

  it('shows one row when the same purchase is the baseline for both horizons', () => {
    stock([['a', '2025-01-01', 'Coles', 300], ['b', '2026-10-01', 'Coles', 360]]);
    renderScreen();
    const rows = within(screen.getByRole('list', { name: 'Price change' })).getAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('vs 6 months ago');
  });

  it('shows a fall as a fall, and no change as none', () => {
    stock([['a', '2026-03-01', 'Coles', 400], ['b', '2026-10-01', 'Coles', 300]]);
    const { unmount } = renderScreen();
    expect(screen.getByRole('list', { name: 'Price change' })).toHaveTextContent('Down 25.0%');
    unmount();
    stock([['a', '2026-03-01', 'Coles', 300], ['b', '2026-10-01', 'Coles', 300]]);
    renderScreen();
    expect(screen.getByRole('list', { name: 'Price change' })).toHaveTextContent('No change');
  });

  it('leaves the change out when nothing was bought long enough ago', () => {
    stock([['a', '2026-09-01', 'Coles', 300], ['b', '2026-10-01', 'Coles', 320]]);
    renderScreen();
    expect(screen.queryByRole('list', { name: 'Price change' })).toBeNull();
  });

  it('names the cheapest shop by average once two shops have sold it', () => {
    renderScreen();
    expect(screen.getByText(/Cheapest at Aldi/)).toHaveTextContent('A$2.90 on average');
  });

  it('names no cheapest shop when only one has sold it', () => {
    stock([['a', '2026-09-01', 'Coles', 300], ['b', '2026-10-01', 'Coles', 320]]);
    renderScreen();
    expect(screen.queryByText(/Cheapest at/)).toBeNull();
  });

  it("lists each shop, cheapest first, with how often, the average and the range", () => {
    renderScreen();
    const shops = within(screen.getByRole('list', { name: 'By shop' })).getAllByRole('listitem');
    expect(shops).toHaveLength(2);
    expect(shops[0]).toHaveTextContent('Aldi');
    expect(shops[0]).toHaveTextContent('1 purchase');
    expect(shops[0]).toHaveTextContent('A$2.90');
    expect(shops[1]).toHaveTextContent('Coles');
    expect(shops[1]).toHaveTextContent('3 purchases');
    expect(shops[1]).toHaveTextContent('A$3.37');
    expect(shops[1]).toHaveTextContent('A$3.10–A$3.60');
  });

  it('lists the purchases newest first, each linking to its expense', () => {
    renderScreen();
    const rows = within(screen.getByRole('list', { name: 'Purchases' })).getAllByRole('link');
    expect(rows.map((r) => r.getAttribute('href'))).toEqual([
      paths.editExpense('e4'), paths.editExpense('e3'), paths.editExpense('e2'), paths.editExpense('e1'),
    ]);
    expect(rows[0]).toHaveTextContent('12 Oct 2026');
    expect(rows[0]).toHaveTextContent('Coles');
    expect(rows[0]).toHaveTextContent('A$3.60');
  });

  it('shows only the latest 30 purchases, and says so', () => {
    stock(Array.from({ length: 32 }, (_, i) => [`p${String(i).padStart(2, '0')}`, `2026-0${1 + Math.floor(i / 28)}-${String(1 + (i % 28)).padStart(2, '0')}`, 'Coles', 300 + i] as [string, string, string, number]));
    renderScreen();
    expect(within(screen.getByRole('list', { name: 'Purchases' })).getAllByRole('link')).toHaveLength(30);
    expect(screen.getByText('Showing the latest 30 of 32 purchases.')).toBeInTheDocument();
  });

  it('draws the chart, with the group currency, once there are two purchases', () => {
    renderScreen();
    const chart = screen.getByTestId('price-chart');
    expect(chart).toHaveAttribute('data-shops', 'Coles,Aldi');
    expect(chart).toHaveAttribute('data-currency', 'AUD');
  });

  it('draws no chart for a single purchase', () => {
    stock([['a', '2026-10-01', 'Coles', 320]]);
    renderScreen();
    expect(screen.queryByTestId('price-chart')).toBeNull();
    expect(screen.getByText(/chart appears/i)).toBeInTheDocument();
  });

  it('says when the chart leaves shops out', () => {
    stock(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((shop, i) => [`p${i}`, `2026-10-0${i + 1}`, shop, 300 + i] as [string, string, string, number]));
    renderScreen();
    expect(screen.getByText(/the 5 shops bought at most/i)).toHaveTextContent('2 others are in the list below');
  });

  it('leaves refunds and other items out', () => {
    history.expenses = [...history.expenses, makeExpense('r1', { day: '2026-10-20', shopName: 'Coles', kind: 'refund', refundOf: 'e4' })];
    history.itemsByExpense = {
      ...history.itemsByExpense,
      r1: [makeItem('r1-i', 'r1', { name: 'Milk 2L', amount: 360, refund: true })],
      e4: [...history.itemsByExpense.e4, makeItem('e4-x', 'e4', { name: 'Bread', amount: 999 })],
    };
    renderScreen();
    expect(within(screen.getByRole('list', { name: 'Purchases' })).getAllByRole('link')).toHaveLength(4);
    expect(header().getByText('A$3.60')).toBeInTheDocument();
  });

  it('says so when the item was never bought', () => {
    renderScreen('Saffron');
    expect(screen.getByRole('heading', { level: 2, name: 'Saffron' })).toBeInTheDocument();
    expect(screen.getByText(/No purchases of “Saffron” yet/)).toBeInTheDocument();
    expect(screen.queryByTestId('price-chart')).toBeNull();
  });

  it('shows loading and errors', () => {
    history.loading = true;
    const { unmount } = renderScreen();
    expect(screen.getByText('Loading')).toBeInTheDocument();
    unmount();
    history.loading = false;
    history.error = 'Could not load';
    renderScreen();
    expect(screen.getByText('Could not load')).toBeInTheDocument();
  });
});
