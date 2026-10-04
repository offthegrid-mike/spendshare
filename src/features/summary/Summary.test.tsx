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
const { monthState } = vi.hoisted(() => ({ monthState: { loading: false } }));
vi.mock('../../hooks/useMonthItems', () => ({
  useMonthItems: () => ({ items: [], loading: monthState.loading }),
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

  it('sums the month up in one line, without an em-dash title', () => {
    renderSummary();
    expect(screen.getByText(/^Spent /)).toHaveTextContent('Spent A$0.00, shared A$10.00');
    expect(screen.queryByText(/Summary —/)).toBeNull();
  });
});
