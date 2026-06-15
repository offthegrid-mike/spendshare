import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Timestamp } from 'firebase/firestore';
import type { GroupDoc, ExpenseDoc, ItemDoc, CategoryDoc } from '../src/types/models';

const nullTs = null as unknown as Timestamp;

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports that transitively
// touch Firebase so that vi.mock factory references are in scope.
// ---------------------------------------------------------------------------
const { writeBatch, doc, serverTimestamp, Timestamp } = vi.hoisted(() => ({
  writeBatch: vi.fn(),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({
    id: segments[segments.length - 1] ?? 'mock-doc-id',
    path: segments.join('/'),
  })),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
  Timestamp: {
    fromDate: vi.fn((d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 })),
    now: vi.fn(() => ({ seconds: 0, nanoseconds: 0 })),
  },
}));

const { useCategories } = vi.hoisted(() => ({
  useCategories: vi.fn(),
}));

const { useItemSuggestions, writeCache } = vi.hoisted(() => ({
  useItemSuggestions: vi.fn(),
  writeCache: vi.fn(),
}));

// ---------------------------------------------------------------------------
// vi.mock calls
// ---------------------------------------------------------------------------
vi.mock('firebase/firestore', () => ({
  writeBatch: (...args: unknown[]) => writeBatch(...args),
  doc: (...args: unknown[]) => doc(...args),
  serverTimestamp: () => serverTimestamp(),
  Timestamp,
  collection: vi.fn(),
  getFirestore: vi.fn(),
}));

vi.mock('../src/lib/firebase', () => ({
  db: { _isMockDb: true },
}));

vi.mock('../src/hooks/useCategories', () => ({
  useCategories: (...args: unknown[]) => useCategories(...args),
}));

vi.mock('../src/hooks/useItemSuggestions', () => ({
  useItemSuggestions: (...args: unknown[]) => useItemSuggestions(...args),
  writeCache: (...args: unknown[]) => writeCache(...args),
}));

vi.mock('react-day-picker', () => ({
  DayPicker: () => <div data-testid="mock-day-picker" />,
}));

vi.mock('react-day-picker/style.css', () => ({}));

// Import the component AFTER mocks are registered.
import ExpenseEditor from '../src/features/expenses/ExpenseEditor';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const categories: CategoryDoc[] = [
  { id: 'cat1', name: 'Groceries', order: 0, archived: false },
  { id: 'cat2', name: 'Dining', order: 1, archived: false },
];

const group: GroupDoc = {
  id: 'g1',
  name: 'Test Group',
  currency: 'AUD',
  ownerUid: 'u1',
  members: {
    u1: { role: 'owner', displayName: 'Alice', email: 'alice@ex.com', joinedAt: nullTs },
    u2: { role: 'member', displayName: 'Bob', email: 'bob@ex.com', joinedAt: nullTs },
  },
  memberUids: ['u1', 'u2'],
  createdAt: nullTs,
};

// A saved expense and its items for edit-mode tests.
const savedExpense: ExpenseDoc = {
  id: 'exp1',
  groupId: 'g1',
  date: { seconds: 1700000000, nanoseconds: 0 } as unknown as Timestamp,
  month: '2023-11',
  shopName: 'Woolworths',
  payerUid: 'u2',
  total: 1550,
  itemCount: 2,
  createdByUid: 'u1',
  createdAt: nullTs,
  updatedAt: nullTs,
};

const savedItems: ItemDoc[] = [
  {
    id: 'item1',
    groupId: 'g1',
    expenseId: 'exp1',
    month: '2023-11',
    name: 'Milk',
    categoryId: 'cat1',
    category: 'Groceries',
    amount: 550,
    shared: true,
    payerUid: 'u2',
  },
  {
    id: 'item2',
    groupId: 'g1',
    expenseId: 'exp1',
    month: '2023-11',
    name: 'Bread',
    categoryId: 'cat1',
    category: 'Groceries',
    amount: 1000,
    shared: false,
    payerUid: 'u2',
  },
];

// A minimal batch mock that records set() calls and exposes a commit spy.
function makeBatchMock() {
  const commitSpy = vi.fn().mockResolvedValue(undefined);
  const setSpy = vi.fn();
  const batch = { set: setSpy, commit: commitSpy };
  writeBatch.mockReturnValue(batch);
  return { batch, commitSpy, setSpy };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ExpenseEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCategories.mockReturnValue({ all: categories, active: categories, loading: false });
    useItemSuggestions.mockReturnValue([
      { name: 'Milk', categoryId: 'cat1', category: 'Groceries', count: 5 },
    ]);
    makeBatchMock();
  });

  // 1. Renders create form -------------------------------------------------
  it('renders date input, shopName input, payerUid select, and at least one line-item row', () => {
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    // Date field
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();

    // Shop name field
    expect(screen.getByLabelText(/shop/i)).toBeInTheDocument();

    // Payer select includes both group members
    const payerSelect = screen.getByLabelText(/paid by|payer/i);
    expect(payerSelect).toBeInTheDocument();
    expect(within(payerSelect as HTMLElement).getByText('Alice')).toBeInTheDocument();
    expect(within(payerSelect as HTMLElement).getByText('Bob')).toBeInTheDocument();

    // At least one item row with name, category, amount, shared fields
    expect(screen.getByPlaceholderText(/item name/i)).toBeInTheDocument();

    // "Add item" button
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
  });

  // 2. Running total -------------------------------------------------------
  it('displays an updated running total as the user enters amounts', async () => {
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    // Enter amount into the first (and only) item row
    const amountInputs = screen.getAllByLabelText(/amount/i);
    await u.clear(amountInputs[0]);
    await u.type(amountInputs[0], '10.50');

    // The live total should reflect A$10.50 (AUD currency)
    expect(await screen.findByText(/10\.50/)).toBeInTheDocument();

    // Add a second item via "Add item" button, then fill its amount
    await u.click(screen.getByRole('button', { name: /add item/i }));
    const amountInputs2 = screen.getAllByLabelText(/amount/i);
    await u.clear(amountInputs2[1]);
    await u.type(amountInputs2[1], '5.00');

    // Total should now be A$15.50
    expect(await screen.findByText(/15\.50/)).toBeInTheDocument();
  });

  // 3. Add line item -------------------------------------------------------
  it('appends a new item row when "Add item" is clicked', async () => {
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    const before = screen.getAllByPlaceholderText(/item name/i).length;
    await u.click(screen.getByRole('button', { name: /add item/i }));
    const after = screen.getAllByPlaceholderText(/item name/i).length;

    expect(after).toBe(before + 1);
  });

  // 4. Validation ----------------------------------------------------------
  it('shows a validation error when shopName is empty and form is submitted', async () => {
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    // Do NOT fill shopName; just submit
    await u.click(screen.getByRole('button', { name: /save|submit|add expense/i }));

    expect(await screen.findByText(/shop name.*required|required.*shop/i)).toBeInTheDocument();
  });

  // 5. Submit creates expense ----------------------------------------------
  it('calls writeBatch commit with expense + item docs when a valid form is submitted', async () => {
    const { commitSpy } = makeBatchMock();

    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    // Fill shop name
    await u.clear(screen.getByLabelText(/shop/i));
    await u.type(screen.getByLabelText(/shop/i), 'Coles');

    // Fill item name
    await u.clear(screen.getByPlaceholderText(/item name/i));
    await u.type(screen.getByPlaceholderText(/item name/i), 'Apples');

    // Fill item amount
    const amountInput = screen.getByLabelText(/amount/i);
    await u.clear(amountInput);
    await u.type(amountInput, '3.99');

    // Submit
    await u.click(screen.getByRole('button', { name: /save|submit|add expense/i }));

    // writeBatch().commit() must have been called
    expect(commitSpy).toHaveBeenCalledTimes(1);
  });

  // 6. Edit mode -----------------------------------------------------------
  it('prefills form fields when expense and items props are provided', () => {
    render(
      <ExpenseEditor
        group={group}
        currentUserUid="u1"
        expense={savedExpense}
        items={savedItems}
      />,
    );

    // Shop name is prefilled
    expect((screen.getByLabelText(/shop/i) as HTMLInputElement).value).toBe('Woolworths');

    // Item names are rendered
    const itemNameInputs = screen.getAllByPlaceholderText(/item name/i);
    const itemNames = itemNameInputs.map((el) => (el as HTMLInputElement).value);
    expect(itemNames).toContain('Milk');
    expect(itemNames).toContain('Bread');

    // Both items appear in the DOM
    expect(itemNameInputs).toHaveLength(2);
  });

  // 7. Gift card — collapsed by default ----------------------------------------
  it('gift card section is collapsed by default', () => {
    render(<ExpenseEditor group={group} currentUserUid="u1" />);
    expect(screen.queryByLabelText(/gift card amount/i)).not.toBeInTheDocument();
  });

  // 8. Gift card — expands on toggle -------------------------------------------
  it('gift card section expands when the toggle button is clicked', async () => {
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    await u.click(screen.getByRole('button', { name: /gift card/i }));
    expect(screen.getByLabelText(/gift card amount/i)).toBeInTheDocument();
  });

  // 9. Gift card — live totals footer ------------------------------------------
  it('totals footer shows receipt total, gift card deduction, and net-to-split when amount is entered', async () => {
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    const amountInput = screen.getAllByLabelText(/^amount/i)[0];
    await u.clear(amountInput);
    await u.type(amountInput, '10.00');

    await u.click(screen.getByRole('button', { name: /gift card/i }));
    const gcInput = screen.getByLabelText(/gift card amount/i);
    await u.clear(gcInput);
    await u.type(gcInput, '5.30');

    expect(screen.getByText(/10\.00/)).toBeInTheDocument();
    expect(screen.getByText(/5\.30/)).toBeInTheDocument();
    expect(screen.getByText(/4\.70/)).toBeInTheDocument();
  });

  // 10. Gift card — clears on collapse -----------------------------------------
  it('hides the paid-to-split line when the gift card section is collapsed', async () => {
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    await u.click(screen.getByRole('button', { name: /gift card/i }));
    await u.type(screen.getByLabelText(/gift card amount/i), '5.30');
    // collapse
    await u.click(screen.getByRole('button', { name: /gift card/i }));

    expect(screen.queryByText(/paid.*to split/i)).not.toBeInTheDocument();
  });

  // 11. Gift card — submitted as cents -----------------------------------------
  it('submits giftCardAmount in cents when a gift card amount is entered', async () => {
    const { setSpy, commitSpy } = makeBatchMock();
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    await u.type(screen.getByLabelText(/shop/i), 'FairPrice');
    await u.type(screen.getByPlaceholderText(/item name/i), 'Milk');
    await u.type(screen.getAllByLabelText(/^amount/i)[0], '10.00');
    await u.click(screen.getByRole('button', { name: /gift card/i }));
    await u.type(screen.getByLabelText(/gift card amount/i), '5.30');

    await u.click(screen.getByRole('button', { name: /save|submit/i }));

    expect(commitSpy).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expCall = setSpy.mock.calls.find(([, d]: [unknown, any]) => 'shopName' in d);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((expCall as any)?.[1]).toMatchObject({ giftCardAmount: 530 });
  });

  // 12. Gift card — omitted when not set ----------------------------------------
  it('does not include giftCardAmount in Firestore doc when gift card is not used', async () => {
    const { setSpy, commitSpy } = makeBatchMock();
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    await u.type(screen.getByLabelText(/shop/i), 'Coles');
    await u.type(screen.getByPlaceholderText(/item name/i), 'Bread');
    await u.type(screen.getAllByLabelText(/^amount/i)[0], '5.00');

    await u.click(screen.getByRole('button', { name: /save|submit/i }));

    expect(commitSpy).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expCall = setSpy.mock.calls.find(([, d]: [unknown, any]) => 'shopName' in d);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((expCall as any)?.[1]).not.toHaveProperty('giftCardAmount');
  });

  // 13. Remark — field present per item row ------------------------------------
  it('renders a remark input for each item row', () => {
    render(<ExpenseEditor group={group} currentUserUid="u1" />);
    expect(screen.getByPlaceholderText(/e\.g\. on sale/i)).toBeInTheDocument();
  });

  // 14. Remark — submitted to Firestore ----------------------------------------
  it('includes remark in item doc when a remark is entered', async () => {
    const { setSpy, commitSpy } = makeBatchMock();
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    await u.type(screen.getByLabelText(/shop/i), 'FairPrice');
    await u.type(screen.getByPlaceholderText(/item name/i), 'Milk');
    await u.type(screen.getAllByLabelText(/^amount/i)[0], '3.50');
    await u.type(screen.getByPlaceholderText(/e\.g\. on sale/i), 'on sale');

    await u.click(screen.getByRole('button', { name: /save|submit/i }));

    expect(commitSpy).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemCall = setSpy.mock.calls.find(([, d]: [unknown, any]) => d?.name === 'Milk');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((itemCall as any)?.[1]).toMatchObject({ remark: 'on sale' });
  });

  // 15. Remark — omitted when empty --------------------------------------------
  it('does not include remark in item doc when remark is empty', async () => {
    const { setSpy, commitSpy } = makeBatchMock();
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    await u.type(screen.getByLabelText(/shop/i), 'Coles');
    await u.type(screen.getByPlaceholderText(/item name/i), 'Bread');
    await u.type(screen.getAllByLabelText(/^amount/i)[0], '5.00');
    // remark left empty

    await u.click(screen.getByRole('button', { name: /save|submit/i }));

    expect(commitSpy).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemCall = setSpy.mock.calls.find(([, d]: [unknown, any]) => d?.name === 'Bread');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((itemCall as any)?.[1]).not.toHaveProperty('remark');
  });

  // 16. Edit mode — prefills remark --------------------------------------------
  it('prefills item remark when editing an expense whose items have remarks', () => {
    const itemsWithRemark: ItemDoc[] = [
      { ...savedItems[0], remark: 'on sale' },
      savedItems[1],
    ];
    render(
      <ExpenseEditor
        group={group}
        currentUserUid="u1"
        expense={savedExpense}
        items={itemsWithRemark}
      />,
    );

    const remarkInputs = screen.getAllByPlaceholderText(/e\.g\. on sale/i);
    expect((remarkInputs[0] as HTMLInputElement).value).toBe('on sale');
    expect((remarkInputs[1] as HTMLInputElement).value).toBe('');
  });

  // 17. Edit mode — prefills gift card -----------------------------------------
  it('opens gift card section and prefills amount when editing an expense with giftCardAmount', () => {
    const expenseWithGc: ExpenseDoc = { ...savedExpense, giftCardAmount: 530 };
    render(
      <ExpenseEditor group={group} currentUserUid="u1" expense={expenseWithGc} items={savedItems} />,
    );

    // Gift card section should be open
    const gcInput = screen.getByLabelText(/gift card amount/i) as HTMLInputElement;
    expect(gcInput).toBeInTheDocument();
    expect(gcInput.value).toBe('5.30');
  });

  // 18. Autocomplete — category pre-fill ------------------------------------
  it('pre-fills the category when an autocomplete suggestion is selected', async () => {
    const { setSpy, commitSpy } = makeBatchMock();
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    await u.type(screen.getByLabelText(/shop/i), 'Coles');

    // Type to trigger the suggestion dropdown
    const nameInput = screen.getByPlaceholderText(/item name/i);
    await u.type(nameInput, 'Mi');

    // Select the 'Milk' suggestion (categoryId: 'cat1')
    const option = await screen.findByRole('option', { name: /Milk/i });
    await u.click(option);

    // Fill amount to satisfy validation
    await u.type(screen.getAllByLabelText(/^amount/i)[0], '3.50');

    await u.click(screen.getByRole('button', { name: /save|submit/i }));

    expect(commitSpy).toHaveBeenCalledTimes(1);
    // The item doc in the batch should carry the pre-filled categoryId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemCall = setSpy.mock.calls.find(([, d]: [unknown, any]) => d?.name === 'Milk');
    expect(itemCall).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((itemCall as any)?.[1]).toMatchObject({ categoryId: 'cat1' });
  });

  // 19. Autocomplete — suggestions doc written in batch --------------------
  it('includes a suggestions doc write in writeBatch when expense is saved', async () => {
    const { setSpy, commitSpy } = makeBatchMock();
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    await u.type(screen.getByLabelText(/shop/i), 'Coles');
    await u.type(screen.getByPlaceholderText(/item name/i), 'Apples');
    await u.type(screen.getAllByLabelText(/^amount/i)[0], '3.00');

    await u.click(screen.getByRole('button', { name: /save|submit/i }));

    expect(commitSpy).toHaveBeenCalledTimes(1);
    // One of the batch.set() calls should be for the suggestions document
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const suggestionsCall = setSpy.mock.calls.find(([ref]: [any]) =>
      String(ref?.path ?? '').includes('suggestions'),
    );
    expect(suggestionsCall).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((suggestionsCall as any)[1]).toMatchObject({ items: expect.any(Array) });
  });
});
