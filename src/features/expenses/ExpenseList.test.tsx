import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExpenseList from './ExpenseList';
import { computeDiscountCents } from '../../lib/discount';
import { formatMoney } from '../../lib/money';

const mockWriteBatch = vi.fn();
vi.mock('firebase/firestore', () => ({
  writeBatch: () => {
    mockWriteBatch();
    return { delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
  },
  doc: vi.fn(),
  collection: vi.fn(),
}));

vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('../../stores/uiStore', () => ({
  useUIStore: () => ({ selectedMonth: '2026-06' }),
}));

const mockUseMonthExpenses = vi.fn();
vi.mock('../../hooks/useMonthExpenses', () => ({
  useMonthExpenses: () => mockUseMonthExpenses(),
}));

const mockGroup = {
  id: 'g1', name: 'Family', currency: 'AUD', ownerUid: 'u1',
  members: { u1: { displayName: 'Alice', email: '', role: 'owner', joinedAt: null } },
  memberUids: ['u1'], createdAt: null,
} as any; // eslint-disable-line @typescript-eslint/no-explicit-any

const mockExpense = {
  id: 'e1', shopName: 'Woolworths', payerUid: 'u1',
  total: 5000, itemCount: 2, groupId: 'g1', month: '2026-06',
  date: null, createdByUid: 'u1', createdAt: null, updatedAt: null,
} as any; // eslint-disable-line @typescript-eslint/no-explicit-any

function renderList() {
  return render(<MemoryRouter><ExpenseList group={mockGroup} /></MemoryRouter>);
}

describe('ExpenseList', () => {
  it('shows skeleton loader when loading', () => {
    mockUseMonthExpenses.mockReturnValue({ expenses: [], itemsByExpense: {}, loading: true });
    renderList();
    const pulses = document.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBe(3);
  });

  it('shows empty state when no expenses', () => {
    mockUseMonthExpenses.mockReturnValue({ expenses: [], itemsByExpense: {}, loading: false });
    renderList();
    expect(screen.getByText(/no expenses for 2026-06/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /add first expense/i })).toBeTruthy();
  });

  it('renders expense card with shop name', () => {
    mockUseMonthExpenses.mockReturnValue({
      expenses: [mockExpense], itemsByExpense: { e1: [] }, loading: false,
    });
    renderList();
    expect(screen.getByText('Woolworths')).toBeTruthy();
  });

  it('renders edit link and delete button', () => {
    mockUseMonthExpenses.mockReturnValue({
      expenses: [mockExpense], itemsByExpense: { e1: [] }, loading: false,
    });
    renderList();
    expect(screen.getByTitle('Edit')).toBeTruthy();
    expect(screen.getByTitle('Delete')).toBeTruthy();
  });

  it('expands to show items on click', () => {
    const mockItem = { id: 'i1', name: 'Milk', amount: 350, categoryId: 'c1', category: 'Food', shared: true, payerUid: 'u1', expenseId: 'e1', groupId: 'g1', month: '2026-06' } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    mockUseMonthExpenses.mockReturnValue({
      expenses: [mockExpense],
      itemsByExpense: { e1: [mockItem] },
      loading: false,
    });
    renderList();
    // Click to expand
    const expandBtn = screen.getAllByRole('button')[0]; // first button = expand
    fireEvent.click(expandBtn);
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders a date section header when expense has a date', () => {
    const expWithDate = {
      ...mockExpense,
      id: 'e2',
      // 2026-06-12 noon UTC — safe for all UTC+ and UTC-8 timezones
      date: { seconds: 1781352000, nanoseconds: 0, toDate: () => new Date(1781352000 * 1000) },
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    mockUseMonthExpenses.mockReturnValue({
      expenses: [expWithDate],
      itemsByExpense: { e2: [] },
      loading: false,
    });
    renderList();
    // A date section header (p with uppercase tracking class) is present
    const headers = document.querySelectorAll('p.text-xs.font-semibold.uppercase');
    expect(headers.length).toBeGreaterThan(0);
  });

  it('renders a category badge on each expense item', () => {
    const expWithDate = {
      ...mockExpense,
      id: 'e3',
      date: { seconds: 1781352000, nanoseconds: 0, toDate: () => new Date(1781352000 * 1000) },
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const itemWithCat = {
      id: 'i1', name: 'Milk', amount: 350, categoryId: 'c1',
      category: 'Food', shared: true, payerUid: 'u1',
      expenseId: 'e3', groupId: 'g1', month: '2026-06',
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    mockUseMonthExpenses.mockReturnValue({
      expenses: [expWithDate],
      itemsByExpense: { e3: [itemWithCat] },
      loading: false,
    });
    renderList();
    // Badge is visible in the card header without expanding
    expect(screen.getByText('Food')).toBeTruthy();
  });

  it('renders the discount line and correct net total when discountPercent is set', () => {
    const expWithDiscount = {
      ...mockExpense,
      id: 'e4',
      total: 10000,
      discountPercent: 2,
    };
    mockUseMonthExpenses.mockReturnValue({
      expenses: [expWithDiscount], itemsByExpense: { e4: [] }, loading: false,
    });
    renderList();
    expect(screen.getByText(/card discount \(2%\)/i)).toBeTruthy();
    // group.currency is 'AUD' — formatMoney renders it as "A$X.XX".
    const expectedNet = 10000 - computeDiscountCents(10000, 2);
    expect(screen.getByText(formatMoney(expectedNet, 'AUD'))).toBeTruthy();
  });

  it('combines gift card and discount in the net total', () => {
    const expWithBoth = {
      ...mockExpense,
      id: 'e5',
      total: 10000,
      giftCardAmount: 5000,
      discountPercent: 2,
    };
    mockUseMonthExpenses.mockReturnValue({
      expenses: [expWithBoth], itemsByExpense: { e5: [] }, loading: false,
    });
    renderList();
    expect(screen.getByText(new RegExp(`gift card ${formatMoney(5000, 'AUD').replace('$', '\\$')}`, 'i'))).toBeTruthy();
    expect(screen.getByText(/card discount \(2%\)/i)).toBeTruthy();
    const afterGiftCard = 10000 - 5000;
    const expectedNet = afterGiftCard - computeDiscountCents(afterGiftCard, 2);
    expect(screen.getByText(formatMoney(expectedNet, 'AUD'))).toBeTruthy();
  });

  it('shows a confirmation dialog instead of deleting immediately', async () => {
    mockUseMonthExpenses.mockReturnValue({
      expenses: [mockExpense], itemsByExpense: { e1: [] }, loading: false,
    });
    renderList();
    fireEvent.click(screen.getByTitle('Delete'));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText(/delete expense/i)).toBeTruthy();
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });

  it('does not delete when the confirmation is cancelled', async () => {
    mockUseMonthExpenses.mockReturnValue({
      expenses: [mockExpense], itemsByExpense: { e1: [] }, loading: false,
    });
    renderList();
    fireEvent.click(screen.getByTitle('Delete'));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });

  it('deletes the expense after confirming', async () => {
    mockUseMonthExpenses.mockReturnValue({
      expenses: [mockExpense], itemsByExpense: { e1: [] }, loading: false,
    });
    renderList();
    fireEvent.click(screen.getByTitle('Delete'));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(mockWriteBatch).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
