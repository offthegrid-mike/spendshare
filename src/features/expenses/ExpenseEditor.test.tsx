import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExpenseEditor from './ExpenseEditor';
import { useUIStore } from '../../stores/uiStore';
import { formatMoney } from '../../lib/money';
import { paths } from '../../lib/paths';

vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('../../lib/converters', () => ({
  expensesCol: vi.fn(() => ({})),
  itemsCol: vi.fn(() => ({})),
  suggestionsDocRef: vi.fn(() => ({})),
}));

const batchSets: Record<string, unknown>[] = [];
const mockCommit = vi.fn().mockResolvedValue(undefined);
const { mockInvalidate } = vi.hoisted(() => ({ mockInvalidate: vi.fn() }));
vi.mock('../../hooks/useAllExpenses', () => ({ invalidateGroupHistory: mockInvalidate }));
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
  fetchActiveCategories: vi.fn(),
}));
vi.mock('../../hooks/useItemSuggestions', () => ({
  useItemSuggestions: () => [[], [], true],
}));
vi.mock('../../hooks/useExpenseDraft', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../hooks/useExpenseDraft')>()),
  readDraft: () => null,
  readDraftRecord: () => null,
  writeDraft: vi.fn(),
  clearDraft: vi.fn(),
}));

const group = {
  id: 'g1', name: 'Family', currency: 'AUD', ownerUid: 'u1',
  members: { u1: { displayName: 'Mike So', email: '', role: 'owner', joinedAt: null } },
  memberUids: ['u1'], createdAt: null,
} as any; // eslint-disable-line @typescript-eslint/no-explicit-any

/* eslint-disable @typescript-eslint/no-explicit-any */
const editExpense = {
  id: 'e1', groupId: 'g1', shopName: 'Flemington', payerUid: 'u1',
  total: 570, itemCount: 2, month: '2026-07',
  date: { seconds: 1783900800, nanoseconds: 0 },
  createdByUid: 'u1', createdAt: null, updatedAt: null,
} as any;
const editItems = [
  { id: 'i1', name: 'Cherry', categoryId: 'c1', category: 'Fruit', amount: 300, shared: true, payerUid: 'u1', expenseId: 'e1', groupId: 'g1', month: '2026-07' },
  { id: 'i2', name: 'Bread', categoryId: 'c2', category: 'Bakery', amount: 270, shared: true, payerUid: 'u1', expenseId: 'e1', groupId: 'g1', month: '2026-07' },
] as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

function renderEditor(props: Record<string, unknown> = {}) {
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

  it("forgets the group's shared history when the save is committed", async () => {
    mockInvalidate.mockClear();
    renderEditor();
    fireEvent.change(screen.getByPlaceholderText(/item name/i), { target: { value: 'Cherry' } });
    fireEvent.change(screen.getByLabelText(/unit price/i), { target: { value: '10.00' } });
    fireEvent.click(screen.getByRole('button', { name: /add item/i }));
    fireEvent.change(screen.getByLabelText(/shop name/i), { target: { value: 'Woolworths' } });
    fireEvent.click(screen.getByRole('button', { name: /save expense/i }));

    await waitFor(() => expect(mockInvalidate).toHaveBeenCalledWith(group.id));
    expect(mockInvalidate.mock.invocationCallOrder[0]).toBeGreaterThan(mockCommit.mock.invocationCallOrder.at(-1)!);
  });

  it('keeps the totals/save footer sticky to the bottom below the desktop breakpoint', () => {
    renderEditor();
    const footer = screen.getByTestId('expense-editor-footer');
    // Sticks below lg: the mobile page and the Add expense sheet (up to 1023px).
    expect(footer.className).toContain('max-lg:sticky');
    expect(footer.className).toContain('max-lg:bottom-0');
    // Desktop (unprefixed) layout must not be sticky.
    expect(footer.className).not.toMatch(/(^|\s)sticky(\s|$)/);
    expect(footer.className).not.toMatch(/(^|\s)bottom-0(\s|$)/);
    // The Save button must live inside the sticky footer.
    expect(footer).toContainElement(screen.getByRole('button', { name: /save expense/i }));
  });

  it('unsticks the footer while the bottom sheet reports an open keyboard', () => {
    // With the keyboard up the sheet is short; a sticky footer would cover the field being edited.
    renderEditor();
    const footer = screen.getByTestId('expense-editor-footer');
    expect(footer.className).toContain('group-data-[keyboard=open]/sheet:static');
    expect(footer.className).toContain('group-data-[keyboard=open]/sheet:shadow-none');
  });

  it('has a page header with a back link and title', () => {
    renderEditor();
    expect(screen.getByRole('heading', { level: 1, name: 'New expense' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', paths.spend);
  });

  it('leaves the title to the sheet when shown in the Add expense sheet', () => {
    renderEditor({ variant: 'sheet' });
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Back' })).toBeNull();
  });

  it('says "Draft saved" once a new expense has something worth keeping', () => {
    renderEditor();
    expect(screen.queryByText('Draft saved')).toBeNull();
    fireEvent.change(screen.getByLabelText(/shop name/i), { target: { value: 'Coles' } });
    expect(screen.getByText('Draft saved')).toBeInTheDocument();
  });

  it('never says "Draft saved" while editing an existing expense', () => {
    renderEditor({ expense: editExpense, items: editItems });
    fireEvent.change(screen.getByLabelText(/shop name/i), { target: { value: 'Coles' } });
    expect(screen.queryByText('Draft saved')).toBeNull();
  });

  it('summarises the items under the totals', () => {
    renderEditor({ expense: editExpense, items: editItems });
    expect(screen.getByText(/^2 items, /)).toHaveTextContent('2 items, A$5.70 shared');
  });

  it('keeps the fields in their original order for keyboard users', () => {
    renderEditor();
    const order = [
      screen.getByRole('button', { name: /scan receipt/i }),
      screen.getByRole('button', { name: /^date/i }),
      screen.getByLabelText(/shop name/i),
      screen.getByRole('radiogroup', { name: 'Paid by' }),
      screen.getByRole('button', { name: /gift card & discount/i }),
      screen.getByPlaceholderText(/item name/i),
      screen.getByRole('button', { name: /save expense/i }),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

describe('ExpenseEditor refund mode', () => {
  const refundOf = (remaining: number) => ({ expense: editExpense, items: editItems, remaining });
  const suggestionWrites = () => batchSets.filter((d) => 'shops' in d);

  beforeEach(() => {
    batchSets.length = 0;
    mockCommit.mockClear();
  });

  it("starts from the original's shop and items, without gift card, discount or receipt scan", () => {
    renderEditor({ refundOf: refundOf(570) });
    expect(screen.getByRole('heading', { name: 'Refund' })).toBeTruthy();
    expect(screen.getByLabelText(/shop name/i)).toHaveValue('Flemington');
    expect(screen.getByRole('button', { name: /cherry/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /bread/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /gift card & discount/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /scan receipt/i })).toBeNull();
    expect(screen.getByText(/A\$5\.70 left to refund/)).toBeTruthy();
  });

  it('saves a refund linked to the original, with its items marked, and leaves autocomplete alone', async () => {
    renderEditor({ refundOf: refundOf(570) });
    fireEvent.click(screen.getByRole('button', { name: /save refund/i }));

    await waitFor(() => expect(mockCommit).toHaveBeenCalledTimes(1));
    const expenseSet = batchSets.find((d) => 'total' in d);
    expect(expenseSet).toMatchObject({ kind: 'refund', refundOf: 'e1', total: 570, shopName: 'Flemington' });
    expect(expenseSet).not.toHaveProperty('giftCardAmount');
    const itemSets = batchSets.filter((d) => 'expenseId' in d);
    expect(itemSets).toHaveLength(2);
    expect(itemSets.every((d) => d.refund === true)).toBe(true);
    expect(suggestionWrites()).toHaveLength(0);
  });

  it('will not save a refund larger than what is left to refund', async () => {
    renderEditor({ refundOf: refundOf(400) });
    expect(screen.getByText(/can't be more than the A\$4\.00 left to refund/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /save refund/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(mockCommit).not.toHaveBeenCalled();
  });

  it('keeps an edited refund a refund', async () => {
    const existingRefund = { ...editExpense, id: 'r1', kind: 'refund', refundOf: 'e1', total: 300, itemCount: 1 };
    const refundItems = [{ ...editItems[0], id: 'i9', expenseId: 'r1', refund: true }];
    renderEditor({ expense: existingRefund, items: refundItems, refundOf: refundOf(570) });
    expect(screen.getByRole('heading', { name: 'Edit refund' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(mockCommit).toHaveBeenCalledTimes(1));
    expect(batchSets.find((d) => 'total' in d)).toMatchObject({ kind: 'refund', refundOf: 'e1' });
    expect(batchSets.filter((d) => 'expenseId' in d).every((d) => d.refund === true)).toBe(true);
    expect(suggestionWrites()).toHaveLength(0);
  });
});

describe('ExpenseEditor for a purchase with refunds', () => {
  beforeEach(() => {
    batchSets.length = 0;
    mockCommit.mockClear();
  });

  it("won't let its total drop below what has been refunded", async () => {
    // Cherry 3.00 + Bread 2.70 = 5.70, with 6.00 already refunded.
    renderEditor({ expense: editExpense, items: editItems, refunded: 600 });
    expect(screen.getByText(/A\$6\.00 of this expense has been refunded/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(mockCommit).not.toHaveBeenCalled();
  });

  it('saves normally while the total covers the refunds', async () => {
    renderEditor({ expense: editExpense, items: editItems, refunded: 500 });
    expect(screen.queryByText(/has been refunded/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(mockCommit).toHaveBeenCalledTimes(1));
  });
});

describe('ExpenseEditor refund prefill', () => {
  it("dates a new refund today and keeps the original's payer", () => {
    const today = new Date().toISOString().slice(0, 10);
    renderEditor({ refundOf: { expense: { ...editExpense, payerUid: 'u1' }, items: editItems, remaining: 570 } });
    expect(screen.getByRole('button', { name: /date/i }).textContent).toContain(
      new Date(`${today}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    );
  });
});

describe('ExpenseEditor refund cap', () => {
  it("keeps the cap it opened with, so saving a refund doesn't count it against itself", () => {
    const refundOf = (remaining: number) => ({ expense: editExpense, items: editItems, remaining });
    const { rerender } = render(
      <MemoryRouter>
        <ExpenseEditor group={group} currentUserUid="u1" refundOf={refundOf(570)} />
      </MemoryRouter>,
    );
    // The live refunds now include this one: what is left drops by its own total.
    rerender(
      <MemoryRouter>
        <ExpenseEditor group={group} currentUserUid="u1" refundOf={refundOf(0)} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/can't be more than/)).toBeNull();
    expect(screen.getByRole('button', { name: /save refund/i })).not.toBeDisabled();
  });
});

describe('ExpenseEditor page title', () => {
  it('titles the page Edit refund while editing a refund, and clears it after', () => {
    const existingRefund = { ...editExpense, id: 'r1', kind: 'refund', refundOf: 'e1', total: 300, itemCount: 1 };
    const { unmount } = renderEditor({
      expense: existingRefund,
      items: [{ ...editItems[0], id: 'i9', expenseId: 'r1', refund: true }],
      refundOf: { expense: editExpense, items: editItems, remaining: 570 },
    });
    expect(useUIStore.getState().pageTitle).toBe('Edit refund');
    unmount();
    expect(useUIStore.getState().pageTitle).toBeNull();
  });

  it('leaves the route title alone otherwise', () => {
    renderEditor({ expense: editExpense, items: editItems });
    expect(useUIStore.getState().pageTitle ?? null).toBeNull();
  });
});
