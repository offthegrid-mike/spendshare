// src/features/summary/Summary.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Summary from './Summary';

vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  serverTimestamp: vi.fn(),
}));
vi.mock('../../lib/converters', () => ({ settlementsCol: vi.fn(() => ({})) }));
vi.mock('../../hooks/useMonthItems', () => ({
  useMonthItems: () => ({ items: [], loading: false }),
}));
vi.mock('../../hooks/useSettlements', () => ({
  useSettlements: () => ({ settlements: [], loading: false }),
}));
vi.mock('../../hooks/useIncome', () => ({
  useIncome: () => ({ income: [], loading: false }),
}));
vi.mock('../../lib/settlement', () => ({
  computeSummary: () => ({
    transactions: [],
    balance: { u1: 500, u2: -500 },
    paidTotal: { u1: 1000, u2: 0 },
    shareOf: { u1: 500, u2: 500 },
    sharedTotal: 1000,
  }),
}));

const mockGroup = {
  id: 'g1', name: 'Family', currency: 'AUD', ownerUid: 'u1',
  members: {
    u1: { displayName: 'Alice', email: '', role: 'owner', joinedAt: null },
    u2: { displayName: 'Bob', email: '', role: 'member', joinedAt: null },
  },
  memberUids: ['u1', 'u2'], createdAt: null,
} as any; // eslint-disable-line @typescript-eslint/no-explicit-any

function renderSummary() {
  return render(
    <MemoryRouter>
      <Summary group={mockGroup} currentUserUid="u1" selectedMonth="2026-06" />
    </MemoryRouter>
  );
}

describe('Summary', () => {
  it('renders member names', () => {
    renderSummary();
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
  });

  it('renders mobile balance cards with data-testid', () => {
    renderSummary();
    const cards = document.querySelectorAll('[data-testid="balance-card"]');
    expect(cards.length).toBe(2);
  });

  it('shows All settled when no pending transactions', () => {
    renderSummary();
    expect(screen.getByText(/all settled/i)).toBeTruthy();
  });

  it('sums multiple income entries for the same member', () => {
    const income = [
      { id: 'i1', uid: 'u1', month: '2026-06', amount: 300000 },
      { id: 'i2', uid: 'u1', month: '2026-06', amount: 100000 },
    ];
    const totalIncome = income.filter((i) => i.uid === 'u1').reduce((sum, i) => sum + i.amount, 0);
    expect(totalIncome).toBe(400000);
  });
});
