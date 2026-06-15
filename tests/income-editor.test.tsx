import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Timestamp } from 'firebase/firestore';
import type { GroupDoc, IncomeDoc } from '../src/types/models';

const nullTs = null as unknown as Timestamp;

const mockBatchSet = vi.fn();
const mockBatchDelete = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn(() => ({ _id: 'new-auto-id' }));
const mockWriteBatch = vi.fn(() => ({
  set: mockBatchSet,
  delete: mockBatchDelete,
  commit: mockBatchCommit,
}));

vi.mock('firebase/firestore', () => ({
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  collection: vi.fn((_db: unknown, path: string) => ({ _path: path })),
  getFirestore: vi.fn(),
}));

vi.mock('../src/lib/firebase', () => ({ db: { _isMockDb: true } }));

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

import IncomeEditor from '../src/features/income/IncomeEditor';

const group: GroupDoc = {
  id: 'g1', name: 'Test Group', currency: 'AUD', ownerUid: 'u1',
  members: {
    u1: { role: 'owner', displayName: 'Alice', email: 'alice@ex.com', joinedAt: nullTs },
    u2: { role: 'member', displayName: 'Bob', email: 'bob@ex.com', joinedAt: nullTs },
  },
  memberUids: ['u1', 'u2'],
  createdAt: nullTs,
};

const selectedMonth = '2026-06';

describe('IncomeEditor (multi-entry)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteBatch.mockReturnValue({
      set: mockBatchSet,
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    });
    mockBatchCommit.mockResolvedValue(undefined);
  });

  it('renders "Your income" section and other member names', () => {
    render(
      <IncomeEditor group={group} currentUserUid="u1" selectedMonth={selectedMonth} income={[]} />,
    );
    expect(screen.getByText(/your income/i)).toBeInTheDocument();
    expect(screen.getByText(/Bob/i)).toBeInTheDocument();
  });

  it('starts with one empty amount input and one description input', () => {
    render(
      <IncomeEditor group={group} currentUserUid="u1" selectedMonth={selectedMonth} income={[]} />,
    );
    expect(screen.getAllByPlaceholderText('0.00')).toHaveLength(1);
    expect(screen.getAllByPlaceholderText(/salary|freelance/i)).toHaveLength(1);
  });

  it('pre-fills amount and description from a single existing income entry', () => {
    const income: IncomeDoc[] = [
      { id: 'doc1', uid: 'u1', month: selectedMonth, amount: 500000, description: 'My salary' },
    ];
    render(
      <IncomeEditor group={group} currentUserUid="u1" selectedMonth={selectedMonth} income={income} />,
    );
    expect((screen.getByPlaceholderText('0.00') as HTMLInputElement).value).toBe('5000.00');
    expect((screen.getByPlaceholderText(/salary|freelance/i) as HTMLInputElement).value).toBe('My salary');
  });

  it('pre-fills two rows when user has two existing income entries', () => {
    const income: IncomeDoc[] = [
      { id: 'doc1', uid: 'u1', month: selectedMonth, amount: 500000, description: 'Salary' },
      { id: 'doc2', uid: 'u1', month: selectedMonth, amount: 100000, description: 'Freelance' },
    ];
    render(
      <IncomeEditor group={group} currentUserUid="u1" selectedMonth={selectedMonth} income={income} />,
    );
    expect(screen.getAllByPlaceholderText('0.00')).toHaveLength(2);
    expect(screen.getAllByPlaceholderText(/salary|freelance/i)).toHaveLength(2);
  });

  it('shows other members existing income total as formatted text', () => {
    const income: IncomeDoc[] = [
      { id: 'doc3', uid: 'u2', month: selectedMonth, amount: 300000 },
    ];
    render(
      <IncomeEditor group={group} currentUserUid="u1" selectedMonth={selectedMonth} income={income} />,
    );
    expect(screen.getByText(/3[,.]?000/)).toBeInTheDocument();
  });

  it('"+ Add income source" button appends a new empty entry row', async () => {
    const u = userEvent.setup();
    render(
      <IncomeEditor group={group} currentUserUid="u1" selectedMonth={selectedMonth} income={[]} />,
    );
    await u.click(screen.getByRole('button', { name: /add income source/i }));
    expect(screen.getAllByPlaceholderText('0.00')).toHaveLength(2);
  });

  it('on save: deletes existing docs and batch.sets a new entry', async () => {
    const u = userEvent.setup();
    const income: IncomeDoc[] = [
      { id: 'old-doc-id', uid: 'u1', month: selectedMonth, amount: 200000 },
    ];
    render(
      <IncomeEditor group={group} currentUserUid="u1" selectedMonth={selectedMonth} income={income} />,
    );

    const amountInput = screen.getByPlaceholderText('0.00');
    await u.clear(amountInput);
    await u.type(amountInput, '5000');

    await u.click(screen.getByRole('button', { name: /save income/i }));
    await waitFor(() => expect(mockBatchCommit).toHaveBeenCalledTimes(1));

    expect(mockBatchDelete).toHaveBeenCalledTimes(1);
    expect(mockBatchSet).toHaveBeenCalledTimes(1);
    const [, payload] = mockBatchSet.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(payload.uid).toBe('u1');
    expect(payload.month).toBe(selectedMonth);
    expect(typeof payload.amount).toBe('number');
    expect((payload.amount as number)).toBeGreaterThan(0);
  });

  it('shows error message when batch.commit rejects', async () => {
    mockBatchCommit.mockRejectedValueOnce(new Error('network'));
    render(
      <IncomeEditor group={group} currentUserUid="u1" selectedMonth={selectedMonth} income={[]} />,
    );
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '3000' } });
    fireEvent.click(screen.getByRole('button', { name: /save income/i }));
    await waitFor(() => expect(screen.getByText(/failed to save/i)).toBeInTheDocument());
  });

  it('shows "Saved!" after successful save', async () => {
    render(
      <IncomeEditor group={group} currentUserUid="u1" selectedMonth={selectedMonth} income={[]} />,
    );
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '3000' } });
    fireEvent.click(screen.getByRole('button', { name: /save income/i }));
    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument());
  });
});
