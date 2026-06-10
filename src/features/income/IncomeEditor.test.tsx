import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IncomeEditor from './IncomeEditor';

vi.mock('../../lib/converters', () => ({ incomeCol: vi.fn(() => ({})) }));
vi.mock('../../lib/money', () => ({
  toCents: (v: string) => Math.round(parseFloat(v || '0') * 100),
  formatMoney: (cents: number, currency: string) => `${currency} ${(cents / 100).toFixed(2)}`,
}));

const mockSetDoc = vi.fn();
const mockDoc = vi.fn(() => ({}));
vi.mock('firebase/firestore', () => ({
  setDoc: (...args: Parameters<typeof mockSetDoc>) => mockSetDoc(...args),
  doc: (...args: Parameters<typeof mockDoc>) => mockDoc(...args),
}));

const group = {
  id: 'g1', name: 'Family', currency: 'AUD',
  ownerUid: 'u1',
  members: {
    u1: { displayName: 'Alice', email: '', role: 'owner', joinedAt: null },
    u2: { displayName: 'Bob', email: '', role: 'member', joinedAt: null },
  },
  memberUids: ['u1', 'u2'],
  createdAt: null,
} as any; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('IncomeEditor', () => {
  beforeEach(() => {
    mockSetDoc.mockResolvedValue(undefined);
    mockDoc.mockReturnValue({});
  });

  it('renders amount and description inputs for current user', () => {
    render(<IncomeEditor group={group} currentUserUid="u1" selectedMonth="2026-06" income={[]} />);
    expect(screen.getByPlaceholderText('0.00')).toBeTruthy();
    expect(screen.getByPlaceholderText(/salary|freelance|description/i)).toBeTruthy();
  });

  it('pre-fills amount and description from existing income', () => {
    const income = [{ uid: 'u1', month: '2026-06', amount: 500000, description: 'My salary' }] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    render(<IncomeEditor group={group} currentUserUid="u1" selectedMonth="2026-06" income={income} />);
    expect((screen.getByPlaceholderText('0.00') as HTMLInputElement).value).toBe('5000.00');
    expect((screen.getByPlaceholderText(/salary|freelance|description/i) as HTMLInputElement).value).toBe('My salary');
  });

  it('shows other member name in read-only section', () => {
    render(<IncomeEditor group={group} currentUserUid="u1" selectedMonth="2026-06" income={[]} />);
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('shows Saved! after successful save', async () => {
    render(<IncomeEditor group={group} currentUserUid="u1" selectedMonth="2026-06" income={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /save income/i }));
    await waitFor(() => expect(screen.getByText(/saved/i)).toBeTruthy());
  });

  it('shows error message on failed save', async () => {
    mockSetDoc.mockRejectedValue(new Error('network error'));
    render(<IncomeEditor group={group} currentUserUid="u1" selectedMonth="2026-06" income={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /save income/i }));
    await waitFor(() => expect(screen.getByText(/failed to save/i)).toBeTruthy());
  });

  it('includes description in setDoc payload when provided', async () => {
    render(<IncomeEditor group={group} currentUserUid="u1" selectedMonth="2026-06" income={[]} />);
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '3000' } });
    fireEvent.change(screen.getByPlaceholderText(/salary|freelance|description/i), { target: { value: 'Salary' } });
    fireEvent.click(screen.getByRole('button', { name: /save income/i }));
    await waitFor(() => expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ description: 'Salary' }),
      expect.anything(),
    ));
  });
});
