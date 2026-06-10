import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Timestamp } from 'firebase/firestore';
import type { ExpenseDoc, ItemDoc, GroupDoc } from '../src/types/models';

// --- Hook mock ---
const { useMonthExpenses } = vi.hoisted(() => ({ useMonthExpenses: vi.fn() }));
vi.mock('../src/hooks/useMonthExpenses', () => ({ useMonthExpenses }));

// --- Firestore mock ---
const mockBatchDelete = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockBatch = vi.fn(() => ({ delete: mockBatchDelete, commit: mockBatchCommit }));

vi.mock('firebase/firestore', () => ({
  writeBatch: mockBatch,
  doc: vi.fn(),
  collection: vi.fn(),
  Timestamp: {
    now: vi.fn(),
    fromDate: vi.fn(),
  },
}));

vi.mock('../src/lib/firebase', () => ({ db: {} }));

// --- Import component after mocks ---
import ExpenseList from '../src/features/expenses/ExpenseList';

// --- Fixtures ---
const expense1: ExpenseDoc & { id: string } = {
  id: 'exp1',
  groupId: 'g1',
  date: { toDate: () => new Date('2026-06-05') } as Timestamp,
  month: '2026-06',
  shopName: 'Woolworths',
  payerUid: 'u1',
  total: 4250, // $42.50
  itemCount: 2,
  createdByUid: 'u1',
  createdAt: {} as Timestamp,
  updatedAt: {} as Timestamp,
};

const items1: ItemDoc[] = [
  {
    id: 'i1',
    groupId: 'g1',
    expenseId: 'exp1',
    month: '2026-06',
    name: 'Milk',
    categoryId: 'cat1',
    category: 'Groceries',
    amount: 250,
    shared: true,
    payerUid: 'u1',
  },
  {
    id: 'i2',
    groupId: 'g1',
    expenseId: 'exp1',
    month: '2026-06',
    name: 'Bread',
    categoryId: 'cat1',
    category: 'Groceries',
    amount: 400,
    shared: false,
    payerUid: 'u1',
  },
];

const group: GroupDoc = {
  id: 'g1',
  name: 'Test Group',
  currency: 'AUD',
  ownerUid: 'u1',
  members: {
    u1: { role: 'owner', displayName: 'Alice', email: 'alice@ex.com', joinedAt: null as unknown as Timestamp },
    u2: { role: 'member', displayName: 'Bob', email: 'bob@ex.com', joinedAt: null as unknown as Timestamp },
  },
  memberUids: ['u1', 'u2'],
  createdAt: null as unknown as Timestamp,
};

function renderExpenseList() {
  return render(
    <MemoryRouter>
      <ExpenseList group={group} />
    </MemoryRouter>,
  );
}

describe('ExpenseList', () => {
  beforeEach(() => {
    useMonthExpenses.mockReset();
    mockBatchDelete.mockReset();
    mockBatchCommit.mockReset().mockResolvedValue(undefined);
    mockBatch.mockClear();
  });

  it('shows an empty-state message when there are no expenses', () => {
    useMonthExpenses.mockReturnValue({
      expenses: [],
      itemsByExpense: {},
      loading: false,
    });

    renderExpenseList();

    // Expect some kind of empty-state message
    expect(
      screen.getByText(/no expenses/i),
    ).toBeInTheDocument();
  });

  it('renders shop name, payer display name, formatted total, and item count', () => {
    useMonthExpenses.mockReturnValue({
      expenses: [expense1],
      itemsByExpense: { exp1: items1 },
      loading: false,
    });

    renderExpenseList();

    // Shop name
    expect(screen.getByText(/Woolworths/i)).toBeInTheDocument();

    // Payer name resolved from group.members.u1
    expect(screen.getByText(/Alice/i)).toBeInTheDocument();

    // Formatted total — AUD $42.50 in some form, e.g. "A$42.50" or "$42.50"
    expect(screen.getByText(/42\.50/)).toBeInTheDocument();

    // Item count
    expect(screen.getByText(/2 items/i)).toBeInTheDocument();
  });

  it('expands line items when the expense row is clicked', async () => {
    useMonthExpenses.mockReturnValue({
      expenses: [expense1],
      itemsByExpense: { exp1: items1 },
      loading: false,
    });

    const u = userEvent.setup();
    renderExpenseList();

    // Line items should not be visible before expanding
    expect(screen.queryByText(/Milk/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bread/i)).not.toBeInTheDocument();

    // Click the expense row to expand
    await u.click(screen.getByText(/Woolworths/i));

    // Now items should be visible
    expect(screen.getByText(/Milk/i)).toBeInTheDocument();
    expect(screen.getByText(/Bread/i)).toBeInTheDocument();
  });

  it('calls writeBatch().commit() when the Delete button is clicked', async () => {
    useMonthExpenses.mockReturnValue({
      expenses: [expense1],
      itemsByExpense: { exp1: items1 },
      loading: false,
    });

    const u = userEvent.setup();
    renderExpenseList();

    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    await u.click(deleteBtn);

    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('renders an edit link pointing to /expense/:id/edit', () => {
    useMonthExpenses.mockReturnValue({
      expenses: [expense1],
      itemsByExpense: { exp1: items1 },
      loading: false,
    });

    renderExpenseList();

    // Either a link or a button that navigates
    const editLink = screen.getByRole('link', { name: /edit/i });
    expect(editLink).toHaveAttribute('href', '/expense/exp1/edit');
  });
});
