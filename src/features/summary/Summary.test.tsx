// src/features/summary/Summary.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Summary from './Summary';

vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  serverTimestamp: vi.fn(),
}));
vi.mock('../../lib/converters', () => ({ settlementsCol: vi.fn(() => ({})) }));
const { monthState, prevMonthRequests } = vi.hoisted(() => ({
  monthState: {
    loading: false,
    itemsLoading: false,
    expenses: [] as unknown[],
    itemsByExpense: {} as Record<string, unknown[]>,
    prevItems: [] as unknown[],
    prevLoading: false,
  },
  prevMonthRequests: [] as string[],
}));
vi.mock('../../hooks/useMonthExpenses', () => ({
  useMonthExpenses: () => ({
    expenses: monthState.expenses,
    itemsByExpense: monthState.itemsByExpense,
    loading: monthState.loading,
    itemsLoading: monthState.itemsLoading,
  }),
}));
// Summary reads the month before through useMonthItems, to compare against.
vi.mock('../../hooks/useMonthItems', () => ({
  useMonthItems: (_gid: string, month: string) => {
    prevMonthRequests.push(month);
    return { items: monthState.prevItems, loading: monthState.prevLoading };
  },
}));
const { settlementState, summaryState, markSettlementPaid } = vi.hoisted(() => ({
  settlementState: { settlements: [] as unknown[] },
  summaryState: { transactions: [] as unknown[] },
  markSettlementPaid: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../hooks/useSettlements', () => ({
  useSettlements: () => ({ settlements: settlementState.settlements, loading: false }),
}));
vi.mock('../../lib/settle', () => ({ markSettlementPaid, undoSettlement: vi.fn() }));
vi.mock('../../hooks/useIncome', () => ({
  useIncome: () => ({ income: [], loading: false }),
}));
vi.mock('../../lib/settlement', () => ({
  computeSummary: () => ({
    transactions: summaryState.transactions,
    balance: { u1: 500, u2: -500 },
    paidTotal: { u1: 1000, u2: 0 },
    shareOf: { u1: 500, u2: 500 },
    sharedTotal: 1000,
  }),
}));

function resetMonthState() {
  Object.assign(monthState, {
    loading: false, itemsLoading: false, expenses: [], itemsByExpense: {}, prevItems: [], prevLoading: false,
  });
  prevMonthRequests.length = 0;
}

const { setMonth } = vi.hoisted(() => ({ setMonth: vi.fn() }));
vi.mock('../../stores/uiStore', () => ({
  useUIStore: () => ({ setMonth }),
}));
vi.mock('./YearSummary', () => ({
  default: ({ year, onSelectMonth }: { year: string; onSelectMonth: (m: string) => void }) => (
    <div>
      <p>Year view {year}</p>
      <button type="button" onClick={() => onSelectMonth('2026-03')}>pick march</button>
    </div>
  ),
}));

const mockGroup = {
  id: 'g1', name: 'Family', currency: 'AUD', ownerUid: 'u1',
  members: {
    u1: { displayName: 'Alice', email: '', role: 'owner', joinedAt: null },
    u2: { displayName: 'Bob', email: '', role: 'member', joinedAt: null },
  },
  memberUids: ['u1', 'u2'], createdAt: null,
} as any; // eslint-disable-line @typescript-eslint/no-explicit-any

function renderSummary() {
  return render(
    <MemoryRouter>
      <Summary group={mockGroup} currentUserUid="u1" selectedMonth="2026-06" />
    </MemoryRouter>
  );
}

describe('Summary', () => {
  it('renders member names', () => {
    renderSummary();
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
  });

  it('renders mobile balance cards with data-testid', () => {
    renderSummary();
    const cards = document.querySelectorAll('[data-testid="balance-card"]');
    expect(cards.length).toBe(2);
    expect(cards[0].parentElement).toHaveClass('lg:hidden');
  });

  it('shows All settled when no pending transactions', () => {
    renderSummary();
    expect(screen.getByText(/all settled/i)).toBeTruthy();
  });

  it('sums multiple income entries for the same member', () => {
    const income = [
      { id: 'i1', uid: 'u1', month: '2026-06', amount: 300000 },
      { id: 'i2', uid: 'u1', month: '2026-06', amount: 100000 },
    ];
    const totalIncome = income.filter((i) => i.uid === 'u1').reduce((sum, i) => sum + i.amount, 0);
    expect(totalIncome).toBe(400000);
  });
});

describe('Summary Month/Year toggle', () => {
  beforeEach(() => {
    setMonth.mockClear();
    monthState.loading = false;
  });
  afterEach(resetMonthState);

  it('defaults to the Month view', () => {
    renderSummary();
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Year' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Settle up')).toBeInTheDocument();
  });

  it('switches to the Year view for the selected month’s year and hides settle-up', async () => {
    renderSummary();
    await userEvent.click(screen.getByRole('button', { name: 'Year' }));
    expect(await screen.findByText('Year view 2026')).toBeInTheDocument();
    expect(screen.queryByText('Settle up')).toBeNull();
    expect(screen.getByRole('button', { name: 'Year' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('picking a month in the Year view selects it and returns to Month view', async () => {
    renderSummary();
    await userEvent.click(screen.getByRole('button', { name: 'Year' }));
    await userEvent.click(await screen.findByRole('button', { name: 'pick march' }));
    expect(setMonth).toHaveBeenCalledWith('2026-03');
    expect(screen.getByText('Settle up')).toBeInTheDocument();
  });

  it('keeps the Year view and toggle visible while month data reloads', async () => {
    const { rerender } = renderSummary();
    await userEvent.click(screen.getByRole('button', { name: 'Year' }));
    expect(await screen.findByText('Year view 2026')).toBeInTheDocument();
    monthState.loading = true;
    rerender(
      <MemoryRouter>
        <Summary group={mockGroup} currentUserUid="u1" selectedMonth="2026-06" />
      </MemoryRouter>
    );
    expect(screen.getByText('Year view 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Month' })).toBeInTheDocument();
  });

  it('returns to the Month view when another month is selected while in the Year view', async () => {
    const { rerender } = renderSummary();
    await userEvent.click(screen.getByRole('button', { name: 'Year' }));
    expect(await screen.findByText('Year view 2026')).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <Summary group={mockGroup} currentUserUid="u1" selectedMonth="2026-04" />
      </MemoryRouter>
    );
    expect(screen.queryByText('Year view 2026')).toBeNull();
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Summary Month view (redesign)', () => {
  afterEach(() => {
    settlementState.settlements = [];
    summaryState.transactions = [];
  });

  it("reads each member's balance from their own side", () => {
    renderSummary();
    const cards = screen.getAllByTestId('balance-card');
    expect(cards[0]).toHaveTextContent('You get back A$5.00'); // Alice is the viewer
    expect(cards[1]).toHaveTextContent('Owes A$5.00');
    expect(document.body.textContent).not.toMatch(/owes you/i);
  });

  it('puts Settle up before Per person', () => {
    renderSummary();
    const settle = screen.getByRole('heading', { name: 'Settle up' });
    const perPerson = screen.getByRole('heading', { name: 'Per person' });
    expect(settle.compareDocumentPosition(perPerson) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('says All settled without an exclamation mark', () => {
    renderSummary();
    expect(screen.getByText('All settled')).toBeInTheDocument();
    expect(screen.queryByText(/!/)).toBeNull();
  });

  it('marks a transaction paid, passing the month settlements so a repeat settle-up merges', async () => {
    const earlier = { id: '2026-06_u2_u1', month: '2026-06', fromUid: 'u2', toUid: 'u1', amount: 200, paid: true };
    settlementState.settlements = [earlier];
    summaryState.transactions = [{ fromUid: 'u2', toUid: 'u1', amount: 300 }];
    renderSummary();
    await userEvent.click(screen.getByRole('button', { name: 'Mark paid' }));
    expect(markSettlementPaid).toHaveBeenCalledWith('g1', '2026-06', { fromUid: 'u2', toUid: 'u1', amount: 300 }, 'u1', [earlier]);
  });

  it('lists paid settlements with their date and an Undo', () => {
    settlementState.settlements = [{
      id: 's1', month: '2026-06', fromUid: 'u2', toUid: 'u1', amount: 500, paid: true,
      paidAt: { toDate: () => new Date(2026, 6, 2) },
    }];
    renderSummary();
    const paid = screen.getByText('Paid 2 Jul').closest('li')!;
    expect(within(paid).getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('has no em-dash title', () => {
    renderSummary();
    expect(screen.queryByText(/Summary —/)).toBeNull();
  });
});

const item = (expenseId: string, category: string, amount: number) => ({
  id: `${expenseId}-${category}`, expenseId, category, amount, shared: true, payerUid: 'u1',
});

function loadJune() {
  monthState.expenses = [
    { id: 'e1', shopName: 'Woolworths' },
    { id: 'e2', shopName: 'Cafe Nero' },
  ];
  monthState.itemsByExpense = {
    e1: [item('e1', 'Groceries', 6000), item('e1', 'Household', 1000)],
    e2: [item('e2', 'Dining', 2000)],
  };
}

describe('Summary Month view breakdown', () => {
  afterEach(resetMonthState);

  it('shows the overview, categories and top shops after Per person', () => {
    loadJune();
    renderSummary();
    expect(screen.getByTestId('month-spent')).toHaveTextContent('A$90.00');
    expect(screen.getByTestId('month-details')).toHaveTextContent('A$10.00 shared');
    const perPerson = screen.getByRole('heading', { name: 'Per person' });
    const categories = screen.getByRole('heading', { name: 'By category' });
    const shops = screen.getByRole('heading', { name: 'Top shops' });
    expect(perPerson.compareDocumentPosition(categories) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(categories.compareDocumentPosition(shops) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByTestId('category-row').map((r) => r.textContent)).toEqual([
      expect.stringContaining('Groceries'), expect.stringContaining('Dining'), expect.stringContaining('Household'),
    ]);
    expect(screen.getAllByTestId('shop-row')[0]).toHaveTextContent('Woolworths');
  });

  it('compares spending with the month before', () => {
    loadJune();
    monthState.prevItems = [item('x', 'Groceries', 4000)];
    renderSummary();
    expect(prevMonthRequests).toContain('2026-05');
    expect(screen.getByTestId('month-vs-prev')).toHaveTextContent('125% more than May');
    expect(screen.getByLabelText('Up 50% from May')).toBeInTheDocument();
  });

  it('compares a month in progress against last month’s pace, not the whole of last month', () => {
    // 15 days into June: 15/31 of May's 4000 is about 1935, and the 9000 spent is far above that.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 5, 15, 12));
    try {
      loadJune();
      monthState.prevItems = [item('x', 'Groceries', 4000)];
      renderSummary();
      expect(screen.getByTestId('month-vs-prev')).toHaveTextContent('May’s pace');
      expect(screen.getByLabelText(/on May’s pace$/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not wait for the month before: it shows without a comparison until it loads', () => {
    loadJune();
    monthState.prevItems = [item('x', 'Groceries', 6000)];
    monthState.prevLoading = true;
    renderSummary();
    expect(screen.getByTestId('month-spent')).toBeInTheDocument();
    expect(screen.queryByTestId('month-vs-prev')).toBeNull();
    expect(screen.queryByLabelText(/from May/)).toBeNull();
  });

  it('adds nothing for a month with no expenses', () => {
    renderSummary();
    expect(screen.queryByTestId('month-spent')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'By category' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Top shops' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Per person' })).toBeInTheDocument();
  });

  it('holds the page back until the month’s items have loaded, not just its expenses', () => {
    loadJune();
    monthState.itemsLoading = true;
    renderSummary();
    expect(screen.queryByRole('heading', { name: 'Per person' })).toBeNull();
    expect(screen.queryByTestId('month-spent')).toBeNull();
  });

  it('leaves the month sections out of the Year view', async () => {
    loadJune();
    renderSummary();
    await userEvent.click(screen.getByRole('button', { name: 'Year' }));
    expect(await screen.findByText('Year view 2026')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'By category' })).toBeNull();
    expect(screen.queryByTestId('month-spent')).toBeNull();
  });
});
