import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

  it('shows a confirmation dialog and does not delete before it is confirmed', async () => {
    useMonthExpenses.mockReturnValue({
      expenses: [expense1],
      itemsByExpense: { exp1: items1 },
      loading: false,
    });

    const u = userEvent.setup();
    renderExpenseList();

    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    await u.click(deleteBtn);

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('does not delete when the confirmation dialog is cancelled', async () => {
    useMonthExpenses.mockReturnValue({
      expenses: [expense1],
      itemsByExpense: { exp1: items1 },
      loading: false,
    });

    const u = userEvent.setup();
    renderExpenseList();

    await u.click(screen.getByRole('button', { name: /delete/i }));
    const dialog = screen.getByRole('alertdialog');
    await u.click(within(dialog).getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('calls writeBatch().commit() when the deletion is confirmed', async () => {
    useMonthExpenses.mockReturnValue({
      expenses: [expense1],
      itemsByExpense: { exp1: items1 },
      loading: false,
    });

    const u = userEvent.setup();
    renderExpenseList();

    await u.click(screen.getByRole('button', { name: /delete/i }));
    const dialog = screen.getByRole('alertdialog');
    await u.click(within(dialog).getByRole('button', { name: /^delete$/i }));

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

  // --- Fixtures for new features ---
  const expenseWithGiftCard: ExpenseDoc = {
    ...expense1,
    id: 'exp2',
    shopName: 'FairPrice',
    total: 1000, // $10.00
    giftCardAmount: 530, // $5.30 — net = $4.70
  };

  const itemsWithRemark: ItemDoc[] = [
    { ...items1[0], remark: 'on sale' },
    items1[1],
  ];

  // 6. Gift card — net amount + strikethrough -----------------------------------
  it('shows the net amount prominently and receipt total as strikethrough when giftCardAmount is set', () => {
    useMonthExpenses.mockReturnValue({
      expenses: [expenseWithGiftCard],
      itemsByExpense: { exp2: [] },
      loading: false,
    });

    renderExpenseList();

    expect(screen.getByText(/4\.70/)).toBeInTheDocument();
    expect(screen.getByText(/10\.00/)).toBeInTheDocument();
  });

  // 7. Gift card badge ----------------------------------------------------------
  it('shows a gift card badge with the gift card amount', () => {
    useMonthExpenses.mockReturnValue({
      expenses: [expenseWithGiftCard],
      itemsByExpense: { exp2: [] },
      loading: false,
    });

    renderExpenseList();

    expect(screen.getByText(/gift card/i)).toBeInTheDocument();
    expect(screen.getByText(/5\.30/)).toBeInTheDocument();
  });

  // 8. No gift card display when absent ----------------------------------------
  it('shows only the total when giftCardAmount is absent', () => {
    useMonthExpenses.mockReturnValue({
      expenses: [expense1],
      itemsByExpense: { exp1: items1 },
      loading: false,
    });

    renderExpenseList();

    expect(screen.getByText(/42\.50/)).toBeInTheDocument();
    expect(screen.queryByText(/gift card/i)).not.toBeInTheDocument();
  });

  // --- Fixtures for discount ---
  const expenseWithDiscount: ExpenseDoc = {
    ...expense1,
    id: 'exp3',
    shopName: 'Costco',
    total: 10000, // $100.00
    discountPercent: 2, // net = $98.00
  };

  it('shows the net amount and strikethrough total when discountPercent is set', () => {
    useMonthExpenses.mockReturnValue({
      expenses: [expenseWithDiscount],
      itemsByExpense: { exp3: [] },
      loading: false,
    });
    renderExpenseList();
    expect(screen.getByText(/98\.00/)).toBeInTheDocument();
    expect(screen.getByText(/100\.00/)).toBeInTheDocument();
  });

  it('shows a card discount badge with the percent', () => {
    useMonthExpenses.mockReturnValue({
      expenses: [expenseWithDiscount],
      itemsByExpense: { exp3: [] },
      loading: false,
    });
    renderExpenseList();
    expect(screen.getByText(/card discount/i)).toBeInTheDocument();
    expect(screen.getByText(/2%/)).toBeInTheDocument();
    // The badge shows the deducted dollar amount too, not just the percent.
    expect(screen.getByText(/2\.00/)).toBeInTheDocument();
  });

  it('combines gift card and discount in the net total', () => {
    const both: ExpenseDoc = { ...expense1, id: 'exp4', total: 10000, giftCardAmount: 5000, discountPercent: 2 };
    useMonthExpenses.mockReturnValue({
      expenses: [both],
      itemsByExpense: { exp4: [] },
      loading: false,
    });
    renderExpenseList();
    // (100 - 50) * 2% = 1.00 -> net = 49.00
    expect(screen.getByText(/49\.00/)).toBeInTheDocument();
    expect(screen.getByText(/gift card/i)).toBeInTheDocument();
    expect(screen.getByText(/card discount/i)).toBeInTheDocument();
  });

  // 9. Remark shown in expanded view -------------------------------------------
  it('shows item remark below item name in the expanded view', async () => {
    useMonthExpenses.mockReturnValue({
      expenses: [expense1],
      itemsByExpense: { exp1: itemsWithRemark },
      loading: false,
    });

    const u = userEvent.setup();
    renderExpenseList();

    await u.click(screen.getByText(/Woolworths/i));

    expect(screen.getByText(/on sale/i)).toBeInTheDocument();
  });

  // 10. No remark element when absent ------------------------------------------
  it('does not render a remark element when item has no remark', async () => {
    useMonthExpenses.mockReturnValue({
      expenses: [expense1],
      itemsByExpense: { exp1: items1 },
      loading: false,
    });

    const u = userEvent.setup();
    renderExpenseList();

    await u.click(screen.getByText(/Woolworths/i));

    expect(screen.queryAllByTestId('item-remark')).toHaveLength(0);
  });
});
