import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Timestamp } from 'firebase/firestore';
import type { GroupDoc, ExpenseDoc, ItemDoc, CategoryDoc, ShopEntry } from '../src/types/models';

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

const { useItemSuggestions } = vi.hoisted(() => ({
  useItemSuggestions: vi.fn(),
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

// The items UI is now a quick-add bar (which appends a collapsed row) plus
// per-row expand/collapse — helpers below drive that flow the way a user
// would, instead of poking at always-visible inline inputs.
async function addQuickItem(
  u: ReturnType<typeof userEvent.setup>,
  name: string,
  amount: string,
) {
  await u.type(screen.getByPlaceholderText(/item name/i), name);
  await u.type(screen.getByLabelText(/unit price/i), amount);
  await u.click(screen.getByRole('button', { name: /add item/i }));
}

// Finds a row's collapsed summary button by its item name and clicks it to
// expand the row (revealing category/amount/remark/remove controls).
async function expandRow(u: ReturnType<typeof userEvent.setup>, itemName: string) {
  await u.click(screen.getByRole('button', { name: new RegExp(itemName, 'i') }));
}

// Reads the label + value text for one totals-footer row, scoped to that
// row's own container so it can't collide with the same amount appearing
// elsewhere on the page (e.g. inside a collapsed item row).
async function footerRowText(labelRegex: RegExp): Promise<string> {
  const label = await screen.findByText(labelRegex);
  return label.closest('div')?.textContent ?? '';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ExpenseEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCategories.mockReturnValue({ all: categories, active: categories, loading: false });
    useItemSuggestions.mockReturnValue([
      [{ name: 'Milk', categoryId: 'cat1', category: 'Groceries', count: 5 }],
      [],
      true,
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

    // Paid by offers both group members, the viewer as "You"
    const payer = screen.getByRole('radiogroup', { name: /paid by/i });
    expect(within(payer).getByRole('radio', { name: /you/i })).toBeChecked();
    expect(within(payer).getByRole('radio', { name: /bob/i })).toBeInTheDocument();

    // At least one item row with name, category, amount, shared fields
    expect(screen.getByPlaceholderText(/item name/i)).toBeInTheDocument();

    // "Add item" button
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
  });

  // 2. Running total -------------------------------------------------------
  it('displays an updated running total as items are added via quick-add', async () => {
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    // Add the first item via the quick-add bar
    await addQuickItem(u, 'Milk', '10.50');

    // The live total should reflect A$10.50 (AUD currency)
    expect(await footerRowText(/receipt total/i)).toMatch(/10\.50/);

    // Add a second item via the quick-add bar
    await addQuickItem(u, 'Bread', '5.00');

    // Total should now be A$15.50
    expect(await footerRowText(/receipt total/i)).toMatch(/15\.50/);
  });

  // 3. Add line item -------------------------------------------------------
  it('adds a new collapsed item row via the quick-add bar', async () => {
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    expect(screen.queryByRole('button', { name: /milk/i })).toBeNull();

    await addQuickItem(u, 'Milk', '3.00');

    expect(screen.getByRole('button', { name: /milk/i })).toBeInTheDocument();
  });

  it('saves the payer picked in Paid by', async () => {
    const { setSpy } = makeBatchMock();
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);
    await u.type(screen.getByLabelText(/shop/i), 'Coles');
    await u.click(screen.getByRole('radio', { name: /bob/i }));
    await addQuickItem(u, 'Apples', '3.99');
    await u.click(screen.getByRole('button', { name: /save|submit|add expense/i }));
    await waitFor(() => expect(setSpy).toHaveBeenCalled());
    const expenseDoc = setSpy.mock.calls[0][1] as { payerUid: string };
    expect(expenseDoc.payerUid).toBe('u2');
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

    // Add an item via the quick-add bar
    await addQuickItem(u, 'Apples', '3.99');

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

    // Both items are rendered as collapsed rows
    expect(screen.getByRole('button', { name: /milk/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bread/i })).toBeInTheDocument();
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

    await addQuickItem(u, 'Milk', '10.00');

    await u.click(screen.getByRole('button', { name: /gift card/i }));
    const gcInput = screen.getByLabelText(/gift card amount/i);
    await u.clear(gcInput);
    await u.type(gcInput, '5.30');

    expect(await footerRowText(/receipt total/i)).toMatch(/10\.00/);
    expect(await footerRowText(/^gift card$/i)).toMatch(/5\.30/);
    expect(await footerRowText(/paid.*to split/i)).toMatch(/4\.70/);
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
    await addQuickItem(u, 'Milk', '10.00');
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
    await addQuickItem(u, 'Bread', '5.00');

    await u.click(screen.getByRole('button', { name: /save|submit/i }));

    expect(commitSpy).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expCall = setSpy.mock.calls.find(([, d]: [unknown, any]) => 'shopName' in d);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((expCall as any)?.[1]).not.toHaveProperty('giftCardAmount');
  });

  // 13. Remark — field present when a row is expanded --------------------------
  it('renders a remark input when an item row is expanded', async () => {
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    await addQuickItem(u, 'Milk', '3.00');
    await expandRow(u, 'milk');

    expect(screen.getByPlaceholderText(/e\.g\. on sale/i)).toBeInTheDocument();
  });

  // 14. Remark — submitted to Firestore ----------------------------------------
  it('includes remark in item doc when a remark is entered', async () => {
    const { setSpy, commitSpy } = makeBatchMock();
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    await u.type(screen.getByLabelText(/shop/i), 'FairPrice');
    await addQuickItem(u, 'Milk', '3.50');
    await expandRow(u, 'milk');
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
    await addQuickItem(u, 'Bread', '5.00');
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

    // Both rows start collapsed — expand them to reveal their remark inputs.
    fireEvent.click(screen.getByRole('button', { name: /milk/i }));
    fireEvent.click(screen.getByRole('button', { name: /bread/i }));

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

  // 20. Shop autocomplete — combobox rendered ---------------------------------
  it('renders ShopNameCombobox for shop name field', () => {
    render(<ExpenseEditor group={group} currentUserUid="u1" onClose={vi.fn()} />);
    // ShopNameCombobox renders an input with role="combobox" labelled "Shop Name"
    expect(screen.getByRole('combobox', { name: /shop name/i })).toBeInTheDocument();
  });

  // 21. Shop autocomplete — suggestions passed to ShopNameCombobox -----------
  it('passes shop suggestions from useItemSuggestions to ShopNameCombobox', () => {
    const mockShops: ShopEntry[] = [{ name: 'Woolworths', count: 5 }];
    // Override the mock persistently for this test to return shop suggestions
    (useItemSuggestions as ReturnType<typeof vi.fn>).mockReturnValue([
      [{ name: 'Milk', categoryId: 'cat1', category: 'Groceries', count: 5 }],
      mockShops,
      true,
    ]);
    render(<ExpenseEditor group={group} currentUserUid="u1" onClose={vi.fn()} />);
    // Type in the shop combobox to trigger suggestions
    const combobox = screen.getByRole('combobox', { name: /shop name/i });
    act(() => {
      fireEvent.change(combobox, { target: { value: 'W' } });
    });
    expect(screen.getByText(/Woolworths/i)).toBeInTheDocument();
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

    // Fill amount and add the item via the quick-add bar
    await u.type(screen.getByLabelText(/unit price/i), '3.50');
    await u.click(screen.getByRole('button', { name: /add item/i }));

    await u.click(screen.getByRole('button', { name: /save|submit/i }));

    expect(commitSpy).toHaveBeenCalledTimes(1);
    // The item doc in the batch should carry the pre-filled categoryId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemCall = setSpy.mock.calls.find(([, d]: [unknown, any]) => d?.name === 'Milk');
    expect(itemCall).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((itemCall as any)?.[1]).toMatchObject({ categoryId: 'cat1' });
  });

  // 22. Loading state — disables and shows a spinner while the batch commit is pending ---
  it('disables the submit button and shows a loading indicator while saving, then re-enables after the save completes', async () => {
    let resolveCommit!: () => void;
    const commitSpy = vi.fn(
      () => new Promise<void>((resolve) => { resolveCommit = resolve; }),
    );
    writeBatch.mockReturnValue({ set: vi.fn(), commit: commitSpy });

    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    await u.type(screen.getByLabelText(/shop/i), 'Coles');
    await addQuickItem(u, 'Apples', '3.00');

    const submitButton = screen.getByRole('button', { name: /save expense/i });
    await u.click(submitButton);

    expect(await screen.findByRole('button', { name: /saving/i })).toBeDisabled();

    await act(async () => {
      resolveCommit();
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: /save expense/i })).not.toBeDisabled();
  });

  // 19. Autocomplete — suggestions doc written in batch --------------------
  it('includes a suggestions doc write in writeBatch when expense is saved', async () => {
    const { setSpy, commitSpy } = makeBatchMock();
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    await u.type(screen.getByLabelText(/shop/i), 'Coles');
    await addQuickItem(u, 'Apples', '3.00');

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

  // 23. Discount — checkbox reveals percent field defaulting to 2% -------------
  it('reveals a percent field defaulting to 2 when "Apply card discount" is checked', async () => {
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    await u.click(screen.getByRole('button', { name: /gift card/i }));
    expect(screen.queryByLabelText(/discount %/i)).not.toBeInTheDocument();

    await u.click(screen.getByRole('checkbox', { name: /apply card discount/i }));
    expect(screen.getByLabelText(/discount %/i)).toHaveValue('2');
  });

  // 24. Discount — totals footer shows discount + net ---------------------------
  it('totals footer shows the card discount deduction and net-to-split', async () => {
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    await addQuickItem(u, 'Milk', '100.00');
    await u.click(screen.getByRole('button', { name: /gift card/i }));
    await u.click(screen.getByRole('checkbox', { name: /apply card discount/i }));

    expect(await footerRowText(/receipt total/i)).toMatch(/100\.00/);
    expect(await footerRowText(/^card discount/i)).toMatch(/2\.00/);
    expect(await footerRowText(/paid.*to split/i)).toMatch(/98\.00/);
  });

  // 25. Discount — applies after gift card ---------------------------------------
  it('applies the percentage discount to the amount remaining after the gift card', async () => {
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    await addQuickItem(u, 'Milk', '100.00');
    await u.click(screen.getByRole('button', { name: /gift card/i }));
    const gcInput = screen.getByLabelText(/gift card amount/i);
    await u.type(gcInput, '50.00');
    await u.click(screen.getByRole('checkbox', { name: /apply card discount/i }));

    // (100 - 50) * 2% = 1.00
    expect(await footerRowText(/^card discount/i)).toMatch(/1\.00/);
    expect(await footerRowText(/paid.*to split/i)).toMatch(/49\.00/);
  });

  // 26. Discount — submitted as a percent number ---------------------------------
  it('submits discountPercent as a number when a discount is applied', async () => {
    const { setSpy, commitSpy } = makeBatchMock();
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    await u.type(screen.getByLabelText(/shop/i), 'FairPrice');
    await addQuickItem(u, 'Milk', '10.00');
    await u.click(screen.getByRole('button', { name: /gift card/i }));
    await u.click(screen.getByRole('checkbox', { name: /apply card discount/i }));

    await u.click(screen.getByRole('button', { name: /save|submit/i }));

    expect(commitSpy).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expCall = setSpy.mock.calls.find(([, d]: [unknown, any]) => 'shopName' in d);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((expCall as any)?.[1]).toMatchObject({ discountPercent: 2 });
  });

  // 27. Discount — omitted when not applied --------------------------------------
  it('does not include discountPercent when the discount is not applied', async () => {
    const { setSpy, commitSpy } = makeBatchMock();
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    await u.type(screen.getByLabelText(/shop/i), 'Coles');
    await addQuickItem(u, 'Bread', '5.00');

    await u.click(screen.getByRole('button', { name: /save|submit/i }));

    expect(commitSpy).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expCall = setSpy.mock.calls.find(([, d]: [unknown, any]) => 'shopName' in d);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((expCall as any)?.[1]).not.toHaveProperty('discountPercent');
  });

  // 28. Discount — clears on uncheck, resets to 2 on recheck --------------------
  it('clears the percent field when the discount checkbox is unchecked, and resets to 2 on recheck', async () => {
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    await u.click(screen.getByRole('button', { name: /gift card/i }));
    const checkbox = screen.getByRole('checkbox', { name: /apply card discount/i });
    await u.click(checkbox);
    await u.clear(screen.getByLabelText(/discount %/i));
    await u.type(screen.getByLabelText(/discount %/i), '5');
    await u.click(checkbox);
    expect(screen.queryByLabelText(/discount %/i)).not.toBeInTheDocument();

    await u.click(checkbox);
    expect(screen.getByLabelText(/discount %/i)).toHaveValue('2');
  });

  // 30. Discount — collapsing the panel clears it, not just hides it ------------
  it('clears the discount when the Gift Card & Discount panel is collapsed', async () => {
    const u = userEvent.setup();
    render(<ExpenseEditor group={group} currentUserUid="u1" />);

    await addQuickItem(u, 'Milk', '100.00');
    const panelToggle = screen.getByRole('button', { name: /gift card/i });
    await u.click(panelToggle);
    await u.click(screen.getByRole('checkbox', { name: /apply card discount/i }));

    // Collapse the panel — the discount should stop being reflected in the footer.
    await u.click(panelToggle);
    expect(screen.queryByText(/paid.*to split/i)).not.toBeInTheDocument();

    // Reopen — the discount should not have survived the collapse.
    await u.click(panelToggle);
    expect(screen.getByRole('checkbox', { name: /apply card discount/i })).not.toBeChecked();
    expect(screen.queryByLabelText(/discount %/i)).not.toBeInTheDocument();
  });

  // 29. Discount — edit mode prefills applied percent ----------------------------
  it('opens the discount field and prefills the percent when editing an expense with discountPercent', () => {
    const expenseWithDiscount: ExpenseDoc = { ...savedExpense, discountPercent: 3 };
    render(
      <ExpenseEditor group={group} currentUserUid="u1" expense={expenseWithDiscount} items={savedItems} />,
    );

    const pctInput = screen.getByLabelText(/discount %/i) as HTMLInputElement;
    expect(pctInput).toBeInTheDocument();
    expect(pctInput.value).toBe('3');
  });
});
