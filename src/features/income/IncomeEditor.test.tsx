import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IncomeEditor from './IncomeEditor';
import type { IncomeDoc } from '../../types/models';

const mockBatchSet = vi.fn();
const mockBatchDelete = vi.fn();
const mockBatchCommit = vi.fn();
const mockDoc = vi.fn(() => ({ _id: 'auto-id' }));
const mockWriteBatch = vi.fn(() => ({
  set: mockBatchSet,
  delete: mockBatchDelete,
  commit: mockBatchCommit,
}));

vi.mock('../../lib/converters', () => ({ incomeCol: vi.fn(() => ({})) }));
vi.mock('../../lib/money', () => ({
  toCents: (v: string) => Math.round(parseFloat(v || '0') * 100),
  formatMoney: (cents: number, currency: string) => `${currency} ${(cents / 100).toFixed(2)}`,
}));
vi.mock('firebase/firestore', () => ({
  writeBatch: (...args: Parameters<typeof mockWriteBatch>) => mockWriteBatch(...args),
  doc: (...args: Parameters<typeof mockDoc>) => mockDoc(...args),
}));
vi.mock('../../lib/firebase', () => ({ db: {} }));

const group = {
  id: 'g1', name: 'Family', currency: 'AUD', ownerUid: 'u1',
  members: {
    u1: { displayName: 'Alice', email: '', role: 'owner', joinedAt: null },
    u2: { displayName: 'Bob', email: '', role: 'member', joinedAt: null },
  },
  memberUids: ['u1', 'u2'],
  createdAt: null,
} as any; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('IncomeEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteBatch.mockReturnValue({
      set: mockBatchSet,
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    });
    mockBatchCommit.mockResolvedValue(undefined);
  });

  it('renders "Your income" section and other members', () => {
    render(<IncomeEditor group={group} currentUserUid="u1" selectedMonth="2026-06" income={[]} />);
    expect(screen.getByText(/your income/i)).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('renders at least one amount input for the current user', () => {
    render(<IncomeEditor group={group} currentUserUid="u1" selectedMonth="2026-06" income={[]} />);
    const amountInputs = screen.getAllByPlaceholderText('0.00');
    expect(amountInputs.length).toBeGreaterThanOrEqual(1);
  });

  it('pre-fills entries from existing income', () => {
    const income: IncomeDoc[] = [
      { id: 'doc1', uid: 'u1', month: '2026-06', amount: 500000, description: 'Salary' },
    ];
    render(<IncomeEditor group={group} currentUserUid="u1" selectedMonth="2026-06" income={income} />);
    expect((screen.getByPlaceholderText('0.00') as HTMLInputElement).value).toBe('5000.00');
    expect((screen.getByPlaceholderText(/salary|freelance/i) as HTMLInputElement).value).toBe('Salary');
  });

  it('"Add income source" button adds a new entry row', () => {
    render(<IncomeEditor group={group} currentUserUid="u1" selectedMonth="2026-06" income={[]} />);
    const before = screen.getAllByPlaceholderText('0.00').length;
    fireEvent.click(screen.getByRole('button', { name: /add income source/i }));
    expect(screen.getAllByPlaceholderText('0.00').length).toBe(before + 1);
  });

  it('shows Saved! after successful batch commit', async () => {
    render(<IncomeEditor group={group} currentUserUid="u1" selectedMonth="2026-06" income={[]} />);
    fireEvent.change(screen.getAllByPlaceholderText('0.00')[0], { target: { value: '3000' } });
    fireEvent.click(screen.getByRole('button', { name: /save income/i }));
    await waitFor(() => expect(screen.getByText(/saved/i)).toBeTruthy());
  });

  it('shows error message on failed batch commit', async () => {
    mockBatchCommit.mockRejectedValue(new Error('network error'));
    render(<IncomeEditor group={group} currentUserUid="u1" selectedMonth="2026-06" income={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /save income/i }));
    await waitFor(() => expect(screen.getByText(/failed to save/i)).toBeTruthy());
  });
});
