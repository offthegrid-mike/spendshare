import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExpenseList from './ExpenseList';

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
      date: { seconds: 1781352000, nanoseconds: 0 },
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
      date: { seconds: 1781352000, nanoseconds: 0 },
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
});
