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
const { exportPeriodCsv } = vi.hoisted(() => ({ exportPeriodCsv: vi.fn() }));
vi.mock('../../lib/exportActions', () => ({ exportPeriodCsv }));
const { monthState, requestedMonths } = vi.hoisted(() => ({
  monthState: {
    loading: false,
    itemsLoading: false,
    expenses: [] as unknown[],
    itemsByExpense: {} as Record<string, unknown[]>,
    prevExpenses: [] as unknown[],
    prevItemsByExpense: {} as Record<string, unknown[]>,
    prevLoading: false,
    prevItemsLoading: false,
  },
  requestedMonths: [] as string[],
}));
// The month under test is June 2026; Summary also reads May, to compare against.
vi.mock('../../hooks/useMonthExpenses', () => ({
  useMonthExpenses: (_gid: string, month: string) => {
    requestedMonths.push(month);
    if (month === '2026-05') {
      return {
        expenses: monthState.prevExpenses,
        itemsByExpense: monthState.prevItemsByExpense,
        loading: monthState.prevLoading,
        itemsLoading: monthState.prevItemsLoading,
      };
    }
    return {
      expenses: monthState.expenses,
      itemsByExpense: monthState.itemsByExpense,
      loading: monthState.loading,
      itemsLoading: monthState.itemsLoading,
    };
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
const { categoryState } = vi.hoisted(() => ({
  categoryState: { all: [] as unknown[], loading: false },
}));
vi.mock('../../hooks/useCategories', () => ({
  useCategories: () => ({ all: categoryState.all, active: categoryState.all, loading: categoryState.loading }),
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
    loading: false, itemsLoading: false, expenses: [], itemsByExpense: {},
    prevExpenses: [], prevItemsByExpense: {}, prevLoading: false, prevItemsLoading: false,
  });
  requestedMonths.length = 0;
  Object.assign(categoryState, { all: [], loading: false });
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

  it('turns off the ← → month keys in the Year view only', async () => {
    renderSummary();
    expect(document.querySelector('[data-no-month-keys]')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Year' }));
    await screen.findByText('Year view 2026');
    expect(document.querySelector('[data-no-month-keys]')).not.toBeNull();
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

const item = (expenseId: string, category: string, amount: number, extra: Record<string, unknown> = {}) => ({
  id: `${expenseId}-${category}`, expenseId, category, categoryId: category.toLowerCase(), amount, shared: true, payerUid: 'u1',
  ...extra,
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

/** May's Groceries: `early` on the 5th, `late` on the 25th. */
function loadMay(early: number, late = 0) {
  const on = (day: number) => ({ toDate: () => new Date(2026, 4, day, 12) });
  monthState.prevExpenses = [
    { id: 'early', shopName: 'Woolworths', date: on(5) },
    { id: 'late', shopName: 'Woolworths', date: on(25) },
  ];
  monthState.prevItemsByExpense = {
    early: [item('early', 'Groceries', early)],
    late: late ? [item('late', 'Groceries', late)] : [],
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
    loadMay(4000);
    renderSummary();
    expect(requestedMonths).toContain('2026-05');
    expect(screen.getByTestId('month-vs-prev')).toHaveTextContent('125% more than May');
    expect(screen.getByLabelText('Up 50% from May')).toBeInTheDocument();
    expect(screen.getByText('Change vs May')).toBeInTheDocument();
  });

  it('compares a month in progress with the same days of last month, not the whole of it', () => {
    // 15 days into June: May had spent 4000 by the 15th and another 6000 after it.
    // June's 9000 is 125% above the 4000, but 10% below the full 10000.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 5, 15, 12));
    try {
      loadJune();
      loadMay(4000, 6000);
      renderSummary();
      expect(screen.getByTestId('month-vs-prev')).toHaveTextContent('125% more than 1–15 May');
      expect(screen.getByLabelText('Up 50% from 1–15 May')).toBeInTheDocument();
      expect(screen.getByText('Change vs 1–15 May')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not wait for the month before: it shows without a comparison until it loads', () => {
    loadJune();
    loadMay(6000);
    monthState.prevLoading = true;
    renderSummary();
    expect(screen.getByTestId('month-spent')).toBeInTheDocument();
    expect(screen.queryByTestId('month-vs-prev')).toBeNull();
    expect(screen.queryByLabelText(/from May/)).toBeNull();
    expect(screen.queryByText(/Change vs/)).toBeNull();
  });

  it('holds the comparison back until the month before has its items, not just its expenses', () => {
    loadJune();
    loadMay(6000);
    monthState.prevItemsLoading = true;
    renderSummary();
    expect(screen.getByTestId('month-spent')).toBeInTheDocument();
    expect(screen.queryByTestId('month-vs-prev')).toBeNull();
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

describe('Summary Month view budgets', () => {
  const cat = (name: string, order: number, extra: Record<string, unknown> = {}) =>
    ({ id: name.toLowerCase(), name, order, archived: false, ...extra });

  afterEach(() => {
    resetMonthState();
    vi.useRealTimers();
  });

  it('shows what each budget has used, between Per person and By category', () => {
    loadJune();
    categoryState.all = [cat('Groceries', 0, { monthlyBudget: 10000 }), cat('Dining', 1)];
    renderSummary();
    const budgets = screen.getByRole('heading', { name: 'Budgets' });
    expect(screen.getByRole('heading', { name: 'Per person' }).compareDocumentPosition(budgets) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(budgets.compareDocumentPosition(screen.getByRole('heading', { name: 'By category' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const rows = screen.getAllByTestId('budget-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Groceries');
    expect(rows[0]).toHaveTextContent('A$60.00 of A$100.00');
    expect(rows[0]).toHaveTextContent('A$40.00 left');
  });

  it('counts personal spending as well as shared', () => {
    loadJune();
    monthState.itemsByExpense = {
      e1: [item('e1', 'Groceries', 6000), item('e1', 'Groceries', 1500, { shared: false })],
    };
    categoryState.all = [cat('Groceries', 0, { monthlyBudget: 10000 })];
    renderSummary();
    expect(screen.getByTestId('budget-row')).toHaveTextContent('A$75.00 of A$100.00');
  });

  it('takes refunds off the spending', () => {
    loadJune();
    monthState.itemsByExpense = {
      e1: [item('e1', 'Groceries', 6000), item('e1', 'Groceries', 2000, { refund: true })],
    };
    categoryState.all = [cat('Groceries', 0, { monthlyBudget: 10000 })];
    renderSummary();
    expect(screen.getByTestId('budget-row')).toHaveTextContent('A$40.00 of A$100.00');
  });

  it('leaves out archived categories and the card itself when nothing has a budget', () => {
    loadJune();
    categoryState.all = [cat('Groceries', 0), cat('Dining', 1, { monthlyBudget: 5000, archived: true })];
    renderSummary();
    expect(screen.queryByRole('heading', { name: 'Budgets' })).toBeNull();
  });

  it('does not wait for the categories: the page shows, and the card joins once they load', () => {
    loadJune();
    categoryState.all = [];
    categoryState.loading = true;
    renderSummary();
    expect(screen.getByRole('heading', { name: 'Per person' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Budgets' })).toBeNull();
  });

  it('marks the pace through a month in progress', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 5, 15, 9)); // 15 of June's 30 days
    loadJune();
    categoryState.all = [cat('Groceries', 0, { monthlyBudget: 10000 })];
    renderSummary();
    expect(screen.getByTestId('budget-pace')).toHaveStyle({ left: '50%' });
    expect(screen.getByText('15 days left')).toBeInTheDocument();
  });

  it('has no pace line for a month that is over', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 10, 9));
    loadJune();
    categoryState.all = [cat('Groceries', 0, { monthlyBudget: 10000 })];
    renderSummary();
    expect(screen.getByTestId('budget-row')).toBeInTheDocument();
    expect(screen.queryByTestId('budget-pace')).toBeNull();
  });

  it('leaves the budgets out of the Year view', async () => {
    loadJune();
    categoryState.all = [cat('Groceries', 0, { monthlyBudget: 10000 })];
    renderSummary();
    await userEvent.click(screen.getByRole('button', { name: 'Year' }));
    expect(await screen.findByText('Year view 2026')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Budgets' })).toBeNull();
  });
});

describe('Summary export', () => {
  beforeEach(() => {
    exportPeriodCsv.mockReset();
    exportPeriodCsv.mockResolvedValue({ status: 'done', message: 'Downloaded spendshare-family-2026-06.csv' });
  });
  afterEach(resetMonthState);

  it('exports the month on screen and says what was saved', async () => {
    renderSummary();
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(exportPeriodCsv).toHaveBeenCalledWith(mockGroup, { kind: 'month', month: '2026-06' });
    expect(await screen.findByText('Downloaded spendshare-family-2026-06.csv')).toBeInTheDocument();
  });

  it('exports the year in the Year view', async () => {
    renderSummary();
    await userEvent.click(screen.getByRole('button', { name: 'Year' }));
    await screen.findByText('Year view 2026');
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(exportPeriodCsv).toHaveBeenCalledWith(mockGroup, { kind: 'year', year: '2026' });
  });

  it('is busy while it works, so it cannot be started twice', async () => {
    let finish: (r: { status: 'done'; message: string }) => void = () => {};
    exportPeriodCsv.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderSummary();
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    const busy = screen.getByRole('button', { name: 'Exporting…' });
    expect(busy).toBeDisabled();
    await userEvent.click(busy);
    expect(exportPeriodCsv).toHaveBeenCalledTimes(1);
    finish({ status: 'done', message: 'Downloaded it' });
    expect(await screen.findByText('Downloaded it')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
  });

  it('shows an empty period or a failure where it can be read', async () => {
    exportPeriodCsv.mockResolvedValue({ status: 'empty', message: 'No expenses in June 2026 to export.' });
    renderSummary();
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(await screen.findByRole('status')).toHaveTextContent('No expenses in June 2026 to export.');
    exportPeriodCsv.mockResolvedValue({ status: 'error', message: "Couldn't reach the server. Check your connection and try again." });
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/couldn't reach the server/i);
  });

  it('drops the message once another month is shown, since it was about the first', async () => {
    const { rerender } = renderSummary();
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(await screen.findByText('Downloaded spendshare-family-2026-06.csv')).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <Summary group={mockGroup} currentUserUid="u1" selectedMonth="2026-07" />
      </MemoryRouter>
    );
    expect(screen.queryByText('Downloaded spendshare-family-2026-06.csv')).toBeNull();
  });

  it('drops the message when the view changes between Month and Year', async () => {
    renderSummary();
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(await screen.findByText('Downloaded spendshare-family-2026-06.csv')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Year' }));
    await screen.findByText('Year view 2026');
    expect(screen.queryByText('Downloaded spendshare-family-2026-06.csv')).toBeNull();
  });

  it('is there while the month is still loading', () => {
    monthState.loading = true;
    renderSummary();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });
});
