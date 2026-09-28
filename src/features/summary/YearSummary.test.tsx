import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import YearSummary from './YearSummary';

const { data } = vi.hoisted(() => ({
  data: {
    items: [] as Array<Record<string, unknown>>,
    income: [] as Array<Record<string, unknown>>,
    loading: false,
  },
}));

vi.mock('../../hooks/useYearItems', () => ({
  useYearItems: () => ({ items: data.items, loading: data.loading }),
}));
vi.mock('../../hooks/useYearIncome', () => ({
  useYearIncome: () => ({ income: data.income, loading: false }),
}));
// Recharts can't lay out in jsdom; charts are verified visually.
const { chartProps } = vi.hoisted(() => ({ chartProps: { current: null as null | Record<string, unknown> } }));
vi.mock('./YearCharts', () => ({
  MonthChart: (props: Record<string, unknown>) => {
    chartProps.current = props;
    return <div data-testid="month-chart" />;
  },
  CategoryChart: () => <div data-testid="category-chart" />,
}));

const group = {
  id: 'g1', name: 'Family', currency: 'USD', ownerUid: 'u1',
  members: {
    u1: { displayName: 'Alice', email: '', role: 'owner', joinedAt: null },
    u2: { displayName: 'Bob', email: '', role: 'member', joinedAt: null },
  },
  memberUids: ['u1', 'u2'], createdAt: null,
} as any; // eslint-disable-line @typescript-eslint/no-explicit-any

function renderYear(onSelectMonth = vi.fn()) {
  render(<YearSummary group={group} year="2026" onSelectMonth={onSelectMonth} />);
  return onSelectMonth;
}

describe('YearSummary', () => {
  beforeEach(() => {
    data.loading = false;
    data.items = [
      { id: 'a', month: '2026-01', amount: 1000, shared: true, payerUid: 'u1', category: 'Groceries' },
      { id: 'b', month: '2026-01', amount: 500, shared: false, payerUid: 'u2', category: 'Dining' },
      { id: 'c', month: '2026-03', amount: 3000, shared: true, payerUid: 'u2', category: 'Groceries' },
    ];
    data.income = [
      { id: 'n1', month: '2026-01', uid: 'u1', amount: 5000 },
      { id: 'n2', month: '2026-03', uid: 'u2', amount: 2000 },
    ];
  });

  it('shows a loading state while data loads', () => {
    data.loading = true;
    renderYear();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows year totals and net', () => {
    renderYear();
    expect(screen.getByTestId('year-total-spending')).toHaveTextContent('$45.00');
    expect(screen.getByTestId('year-total-shared')).toHaveTextContent('$40.00');
    expect(screen.getByTestId('year-total-income')).toHaveTextContent('$70.00');
    expect(screen.getByTestId('year-net')).toHaveTextContent('$25.00');
  });

  it('colours a negative net in rose', () => {
    data.income = [];
    renderYear();
    expect(screen.getByTestId('year-net')).toHaveClass('text-rose-600');
  });

  it('colours a positive net in brand green', () => {
    renderYear();
    expect(screen.getByTestId('year-net')).toHaveClass('text-brand-700');
  });

  it('colours a zero net in slate', () => {
    data.items = [];
    data.income = [];
    renderYear();
    expect(screen.getByTestId('year-net')).toHaveClass('text-slate-500');
  });

  it('renders one mobile per-person card per member', () => {
    renderYear();
    const cards = screen.getAllByTestId('year-person-card');
    expect(cards).toHaveLength(2);
    expect(within(cards[1]).getByText('Bob')).toBeInTheDocument();
    expect(within(cards[1]).getByText(/Paid \$35\.00/)).toBeInTheDocument();
  });

  it('renders the charts and a 12-row month table', () => {
    renderYear();
    expect(screen.getByTestId('month-chart')).toBeInTheDocument();
    expect(screen.getByTestId('category-chart')).toBeInTheDocument();
    expect(screen.getAllByTestId('year-month-row')).toHaveLength(12);
  });

  it('shows the monthly averages under the month table', () => {
    renderYear();
    const row = screen.getByTestId('year-month-average');
    expect(row).toHaveTextContent('Average (2 months)');
    expect(row).toHaveTextContent('$22.50');
    expect(row).toHaveTextContent('$35.00');
  });

  it('uses the singular for a single active month', () => {
    data.items = [data.items[0]];
    data.income = [];
    renderYear();
    expect(screen.getByTestId('year-month-average')).toHaveTextContent('Average (1 month)');
  });

  it('passes the averages to the month chart for its reference lines', () => {
    renderYear();
    expect(chartProps.current).toMatchObject({ avgSpending: 2250, avgIncome: 3500 });
  });

  it('jumps to a month when its row is clicked', async () => {
    const onSelectMonth = renderYear();
    await userEvent.click(screen.getByRole('button', { name: 'View Mar 2026' }));
    expect(onSelectMonth).toHaveBeenCalledWith('2026-03');
  });

  it('shows an empty message and no charts for an empty year', () => {
    data.items = [];
    data.income = [];
    renderYear();
    expect(screen.getByText('No spending or income recorded for 2026.')).toBeInTheDocument();
    expect(screen.queryByTestId('month-chart')).toBeNull();
    expect(screen.queryByTestId('category-chart')).toBeNull();
  });
});
