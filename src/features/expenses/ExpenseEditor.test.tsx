import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExpenseEditor from './ExpenseEditor';

vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('../../lib/converters', () => ({
  expensesCol: vi.fn(() => ({})),
  itemsCol: vi.fn(() => ({})),
  suggestionsDocRef: vi.fn(() => ({})),
}));
vi.mock('../../hooks/useCategories', () => ({
  useCategories: () => ({
    all: [], loading: false,
    active: [
      { id: 'c1', name: 'Fruit', order: 0, archived: false },
      { id: 'c2', name: 'Bakery', order: 1, archived: false },
    ],
  }),
}));
vi.mock('../../hooks/useItemSuggestions', () => ({
  useItemSuggestions: () => [[], [], true],
  writeCache: vi.fn(),
}));
vi.mock('../../hooks/useExpenseDraft', () => ({
  readDraft: () => null,
  writeDraft: vi.fn(),
  clearDraft: vi.fn(),
}));

const group = {
  id: 'g1', name: 'Family', currency: 'AUD', ownerUid: 'u1',
  members: { u1: { displayName: 'Mike So', email: '', role: 'owner', joinedAt: null } },
  memberUids: ['u1'], createdAt: null,
} as any; // eslint-disable-line @typescript-eslint/no-explicit-any

function renderEditor(props = {}) {
  return render(
    <MemoryRouter>
      <ExpenseEditor group={group} currentUserUid="u1" {...props} />
    </MemoryRouter>,
  );
}

describe('ExpenseEditor (hybrid)', () => {
  it('starts a new expense with no item rows and an empty-state hint', () => {
    renderEditor();
    expect(screen.getByText(/no items yet/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /remove item/i })).toBeNull();
  });

  it('adds an item via the quick-add bar as a collapsed row', () => {
    renderEditor();
    fireEvent.change(screen.getByPlaceholderText(/item name/i), { target: { value: 'Cherry' } });
    fireEvent.change(screen.getByLabelText(/unit price/i), { target: { value: '3.00' } });
    fireEvent.click(screen.getByRole('button', { name: /add item/i }));

    expect(screen.getByRole('button', { name: /cherry/i })).toBeTruthy();
    expect(screen.queryByText(/no items yet/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/on sale, for party/i)).toBeNull();
  });

  it('expands a row to reveal the full editor when clicked', () => {
    renderEditor();
    fireEvent.change(screen.getByPlaceholderText(/item name/i), { target: { value: 'Cherry' } });
    fireEvent.change(screen.getByLabelText(/unit price/i), { target: { value: '3.00' } });
    fireEvent.click(screen.getByRole('button', { name: /add item/i }));

    fireEvent.click(screen.getByRole('button', { name: /cherry/i }));
    expect(screen.getByPlaceholderText(/on sale, for party/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /remove item/i })).toBeTruthy();
  });

  it('renders existing items as collapsed rows when editing', () => {
    const expense = {
      id: 'e1', groupId: 'g1', shopName: 'Flemington', payerUid: 'u1',
      total: 570, itemCount: 2, month: '2026-07',
      date: { seconds: 1783900800, nanoseconds: 0 },
      createdByUid: 'u1', createdAt: null, updatedAt: null,
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const items = [
      { id: 'i1', name: 'Cherry', categoryId: 'c1', category: 'Fruit', amount: 300, shared: true, payerUid: 'u1', expenseId: 'e1', groupId: 'g1', month: '2026-07' },
      { id: 'i2', name: 'Bread', categoryId: 'c2', category: 'Bakery', amount: 270, shared: true, payerUid: 'u1', expenseId: 'e1', groupId: 'g1', month: '2026-07' },
    ] as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    renderEditor({ expense, items });
    expect(screen.getByRole('button', { name: /cherry/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /bread/i })).toBeTruthy();
    expect(screen.queryByPlaceholderText(/on sale, for party/i)).toBeNull();
  });
});
