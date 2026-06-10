import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Timestamp } from 'firebase/firestore';
import type { GroupDoc, IncomeDoc } from '../src/types/models';

const nullTs = null as unknown as Timestamp;

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { setDoc, doc } = vi.hoisted(() => ({
  setDoc: vi.fn().mockResolvedValue(undefined),
  doc: vi.fn((_col: unknown, id: string) => ({ _id: id })),
}));

// ---------------------------------------------------------------------------
// vi.mock calls
// ---------------------------------------------------------------------------

vi.mock('firebase/firestore', () => ({
  setDoc: (...args: unknown[]) => setDoc(...args),
  doc: (...args: unknown[]) => doc(...(args as Parameters<typeof doc>)),
  collection: vi.fn((_db: unknown, path: string) => ({ _path: path })),
  getFirestore: vi.fn(),
}));

vi.mock('../src/lib/firebase', () => ({
  db: { _isMockDb: true },
}));

// Mock converters — incomeCol returns a fake typed collection ref.
vi.mock('../src/lib/converters', () => ({
  incomeCol: (gid: string) => ({ _path: `groups/${gid}/income` }),
  usersCol: {},
  groupsCol: {},
  expensesCol: vi.fn(),
  itemsCol: vi.fn(),
  categoriesCol: vi.fn(),
  invitesCol: vi.fn(),
  settlementsCol: vi.fn(),
}));

// Import the component AFTER all mocks are in place.
import IncomeEditor from '../src/features/income/IncomeEditor';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

const selectedMonth = '2026-06';

const existingIncome: IncomeDoc[] = [
  { uid: 'u1', month: '2026-06', amount: 500000 }, // $5 000.00 in cents
  { uid: 'u2', month: '2026-06', amount: 300000 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IncomeEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDoc.mockResolvedValue(undefined);
  });

  // 1. Renders one row per group member ----------------------------------------
  it('renders one row per group member showing their display name', () => {
    render(
      <IncomeEditor
        group={group}
        currentUserUid="u1"
        selectedMonth={selectedMonth}
        income={[]}
      />,
    );

    // Current user (Alice) shows "Your income" section instead of their name
    expect(screen.getByText(/your income/i)).toBeInTheDocument();
    expect(screen.getByText(/Bob/i)).toBeInTheDocument();
  });

  // 2. Only the current user's row has an editable input; others are read-only --
  it('renders an editable input only for the current user, read-only display for others', () => {
    render(
      <IncomeEditor
        group={group}
        currentUserUid="u1"
        selectedMonth={selectedMonth}
        income={[]}
      />,
    );

    // Only one editable input (for current user u1)
    const amountInputs = screen.getAllByRole('spinbutton'); // <input type="number">
    expect(amountInputs).toHaveLength(1);

    // Bob's row should show a read-only placeholder
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  // 3. Pre-fills existing income amounts for current user -----------------------
  it('pre-fills the current user income input with their existing amount', () => {
    render(
      <IncomeEditor
        group={group}
        currentUserUid="u1"
        selectedMonth={selectedMonth}
        income={existingIncome}
      />,
    );

    const amountInput = screen.getByRole('spinbutton') as HTMLInputElement;

    // The input for u1 should be pre-filled with their amount (5000.00 from 500000 cents)
    expect(parseFloat(amountInput.value)).toBeGreaterThan(0);
  });

  // 3b. Other member's existing income is shown as read-only text ---------------
  it('shows other members existing income as read-only text', () => {
    render(
      <IncomeEditor
        group={group}
        currentUserUid="u1"
        selectedMonth={selectedMonth}
        income={existingIncome}
      />,
    );

    // Bob's income (300000 cents = 3000.00) should be shown as display text with currency formatting
    expect(screen.getByText(/3[,.]?000/)).toBeInTheDocument();
  });

  // 4. On save, calls setDoc only for current user with deterministic id ---------
  it('calls setDoc only for the current user with id ${uid}_${month} on save', async () => {
    const u = userEvent.setup();

    render(
      <IncomeEditor
        group={group}
        currentUserUid="u1"
        selectedMonth={selectedMonth}
        income={[]}
      />,
    );

    // Fill in amount for current user (only one input)
    const amountInput = screen.getByRole('spinbutton');
    await u.clear(amountInput);
    await u.type(amountInput, '5000');

    // Submit the form
    const saveButton = screen.getByRole('button', { name: /save|submit/i });
    await u.click(saveButton);

    // setDoc must have been called exactly once (only for current user)
    expect(setDoc).toHaveBeenCalledTimes(1);

    // doc() must have been called with the current user's deterministic id only
    const docIds = doc.mock.calls.map((call) => call[1] as string);
    expect(docIds).toContain(`u1_${selectedMonth}`);
    expect(docIds).not.toContain(`u2_${selectedMonth}`);
  });

  // 5. setDoc is called with merge:true -------------------------------------------
  it('calls setDoc with merge: true option', async () => {
    const u = userEvent.setup();

    render(
      <IncomeEditor
        group={group}
        currentUserUid="u1"
        selectedMonth={selectedMonth}
        income={[]}
      />,
    );

    const amountInput = screen.getByRole('spinbutton');
    await u.clear(amountInput);
    await u.type(amountInput, '5000');

    const saveButton = screen.getByRole('button', { name: /save|submit/i });
    await u.click(saveButton);

    // At least one setDoc call should include { merge: true }
    const mergeCallArgs = setDoc.mock.calls.find(
      (call) => call[2] && (call[2] as Record<string, unknown>).merge === true,
    );
    expect(mergeCallArgs).toBeDefined();
  });

  // 6. setDoc payload contains uid, month, amount for current user ---------------
  it('includes uid, month, and amount in the setDoc payload for current user', async () => {
    const u = userEvent.setup();

    render(
      <IncomeEditor
        group={group}
        currentUserUid="u1"
        selectedMonth={selectedMonth}
        income={[]}
      />,
    );

    const amountInput = screen.getByRole('spinbutton');
    await u.clear(amountInput);
    await u.type(amountInput, '5000');

    const saveButton = screen.getByRole('button', { name: /save|submit/i });
    await u.click(saveButton);

    // The setDoc call should include a payload with uid, month, and amount fields
    const payloads = setDoc.mock.calls.map((call) => call[1] as Record<string, unknown>);
    const u1Payload = payloads.find((p) => p.uid === 'u1');
    expect(u1Payload).toBeDefined();
    expect(u1Payload?.month).toBe(selectedMonth);
    expect(typeof u1Payload?.amount).toBe('number');
  });
});
