import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExpenseEditor from './ExpenseEditor';
import { formatMoney } from '../../lib/money';

vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('../../lib/converters', () => ({
  expensesCol: vi.fn(() => ({})),
  itemsCol: vi.fn(() => ({})),
  suggestionsDocRef: vi.fn(() => ({})),
}));

const batchSets: Record<string, unknown>[] = [];
const mockCommit = vi.fn().mockResolvedValue(undefined);
vi.mock('firebase/firestore', () => ({
  writeBatch: () => ({
    set: (_ref: unknown, data: Record<string, unknown>) => { batchSets.push(data); },
    delete: vi.fn(),
    commit: mockCommit,
  }),
  doc: vi.fn(() => ({ id: 'new-expense-id' })),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  Timestamp: {
    fromDate: (d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 }),
  },
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

  it('reveals a 2%-default percent field when "Apply card discount" is checked', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /gift card & discount/i }));
    expect(screen.queryByLabelText(/discount %/i)).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: /apply card discount/i }));
    expect(screen.getByLabelText(/discount %/i)).toHaveValue('2');
  });

  it('clears the percent field when the discount checkbox is unchecked', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /gift card & discount/i }));
    const checkbox = screen.getByRole('checkbox', { name: /apply card discount/i });
    fireEvent.click(checkbox);
    fireEvent.change(screen.getByLabelText(/discount %/i), { target: { value: '5' } });
    fireEvent.click(checkbox);
    expect(screen.queryByLabelText(/discount %/i)).toBeNull();

    fireEvent.click(checkbox);
    expect(screen.getByLabelText(/discount %/i)).toHaveValue('2');
  });

  it('clears the discount when the Gift Card & Discount panel is collapsed', () => {
    renderEditor();
    const panelToggle = screen.getByRole('button', { name: /gift card & discount/i });
    fireEvent.click(panelToggle);
    fireEvent.click(screen.getByRole('checkbox', { name: /apply card discount/i }));

    // Collapse the panel.
    fireEvent.click(panelToggle);
    // Reopen it — the discount should not have survived the collapse.
    fireEvent.click(panelToggle);
    expect(screen.getByRole('checkbox', { name: /apply card discount/i })).not.toBeChecked();
    expect(screen.queryByLabelText(/discount %/i)).toBeNull();
  });

  it('shows the computed discount amount and net total in the footer', () => {
    renderEditor();
    fireEvent.change(screen.getByPlaceholderText(/item name/i), { target: { value: 'Cherry' } });
    fireEvent.change(screen.getByLabelText(/unit price/i), { target: { value: '100.00' } });
    fireEvent.click(screen.getByRole('button', { name: /add item/i }));

    fireEvent.click(screen.getByRole('button', { name: /gift card & discount/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /apply card discount/i }));

    // group.currency is 'AUD' — formatMoney renders it as "A$X.XX", not "$X.XX".
    expect(screen.getByText(/card discount \(2%\)/i)).toBeTruthy();
    expect(screen.getByText(`− ${formatMoney(200, 'AUD')}`)).toBeTruthy(); // 2% of $100 = $2.00
    expect(screen.getByText(formatMoney(9800, 'AUD'))).toBeTruthy(); // Paid (to split)
  });

  it('applies the gift card before the percentage discount', () => {
    renderEditor();
    fireEvent.change(screen.getByPlaceholderText(/item name/i), { target: { value: 'Cherry' } });
    fireEvent.change(screen.getByLabelText(/unit price/i), { target: { value: '100.00' } });
    fireEvent.click(screen.getByRole('button', { name: /add item/i }));

    fireEvent.click(screen.getByRole('button', { name: /gift card & discount/i }));
    fireEvent.change(screen.getByLabelText(/gift card amount/i), { target: { value: '50.00' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /apply card discount/i }));

    // (100 - 50) * 2% = 1.00
    expect(screen.getByText(`− ${formatMoney(100, 'AUD')}`)).toBeTruthy();
    expect(screen.getByText(formatMoney(4900, 'AUD'))).toBeTruthy(); // Paid (to split)
  });

  it('writes discountPercent to the expense doc on submit', async () => {
    renderEditor();
    fireEvent.change(screen.getByPlaceholderText(/item name/i), { target: { value: 'Cherry' } });
    fireEvent.change(screen.getByLabelText(/unit price/i), { target: { value: '10.00' } });
    fireEvent.click(screen.getByRole('button', { name: /add item/i }));

    fireEvent.change(screen.getByLabelText(/shop name/i), { target: { value: 'Woolworths' } });
    fireEvent.click(screen.getByRole('button', { name: /gift card & discount/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /apply card discount/i }));

    fireEvent.click(screen.getByRole('button', { name: /save expense/i }));

    await waitFor(() => expect(mockCommit).toHaveBeenCalledTimes(1));
    const expenseSet = batchSets.find((d) => 'total' in d);
    expect(expenseSet?.discountPercent).toBe(2);
  });

  it('keeps the totals/save footer sticky to the bottom on mobile only', () => {
    renderEditor();
    const footer = screen.getByTestId('expense-editor-footer');
    expect(footer.className).toContain('max-sm:sticky');
    expect(footer.className).toContain('max-sm:bottom-0');
    // Desktop (unprefixed) layout must not be sticky.
    expect(footer.className).not.toMatch(/(^|\s)sticky(\s|$)/);
    expect(footer.className).not.toMatch(/(^|\s)bottom-0(\s|$)/);
    // The Save button must live inside the sticky footer.
    expect(footer).toContainElement(screen.getByRole('button', { name: /save expense/i }));
  });
});
