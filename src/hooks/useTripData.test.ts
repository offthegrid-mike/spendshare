import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { makeExpense } from '../test/fixtures';

const state = vi.hoisted(() => ({ expensesLoading: false, walletsLoading: false }));
const dinner = makeExpense('dinner', { currency: 'JPY', total: 60000, paidWith: { kind: 'wallet', walletId: 'alex_JPY' } });
vi.mock('./useTripExpenses', () => ({
  useTripExpenses: () => ({ expenses: [dinner], itemsByExpense: {}, loading: state.expensesLoading, itemsLoading: false, error: false, retry: vi.fn() }),
}));
vi.mock('./useTripWallets', () => ({
  useTripWallets: () => ({
    wallets: [{ id: 'alex_JPY', kind: 'personal', ownerUid: 'alex', currency: 'JPY' }],
    topUps: [
      { id: 't1', walletId: 'alex_JPY', date: '2027-05-09', foreignAmount: 50000, homeAmount: 50000 },
      { id: 't2', walletId: 'alex_JPY', date: '2027-05-09', foreignAmount: 50000, homeAmount: 53000 },
    ],
    loading: state.walletsLoading,
    error: false,
  }),
}));

import { useTripData } from './useTripData';

describe('useTripData', () => {
  it('values cash payments from the trip’s wallets (example A)', () => {
    const { result } = renderHook(() => useTripData('japan'));
    expect(result.current.cash.values).toEqual({ dinner: 61800 });
    expect(result.current.loading).toBe(false);
  });

  it('is loading until both expenses and wallets have loaded', () => {
    state.walletsLoading = true;
    const { result } = renderHook(() => useTripData('japan'));
    expect(result.current.loading).toBe(true);
    state.walletsLoading = false;
  });
});
