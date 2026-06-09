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
});
