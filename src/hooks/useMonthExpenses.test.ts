import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMonthExpenses } from './useMonthExpenses';

const { callbacks, errorCallbacks } = vi.hoisted(() => ({
  callbacks: new Map<string, (snap: unknown) => void>(),
  errorCallbacks: new Map<string, () => void>(),
}));

vi.mock('../lib/converters', () => ({ expensesCol: () => 'EXPENSES_COL' }));
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  query: (base: string) => base,
  where: () => ({}),
  orderBy: () => ({}),
  collectionGroup: () => 'ITEMS_COL',
  onSnapshot: (q: string, cb: (snap: unknown) => void, onError?: () => void) => {
    callbacks.set(q, cb);
    if (onError) errorCallbacks.set(q, onError);
    return () => callbacks.delete(q);
  },
}));

function fakeSnap(docs: Array<Record<string, unknown>>) {
  return { docs: docs.map((data) => ({ data: () => data, id: (data.id as string) ?? 'id' })) };
}

describe('useMonthExpenses', () => {
  beforeEach(() => {
    callbacks.clear();
    errorCallbacks.clear();
  });

  it('flips `loading` false as soon as the expenses snapshot fires, independent of items', () => {
    const { result } = renderHook(() => useMonthExpenses('g1', '2026-07'));
    expect(result.current.loading).toBe(true);

    act(() => {
      callbacks.get('EXPENSES_COL')!(fakeSnap([{ id: 'e1', month: '2026-07' }]));
    });
    expect(result.current.expenses.length).toBe(1);
    expect(result.current.loading).toBe(false);
    // Items haven't arrived yet — a plain `loading` consumer (e.g. ExpenseList)
    // isn't held back by them.
    expect(result.current.itemsLoading).toBe(true);
  });

  it('flips `itemsLoading` false only once the items snapshot fires', () => {
    const { result } = renderHook(() => useMonthExpenses('g1', '2026-07'));
    expect(result.current.itemsLoading).toBe(true);

    act(() => {
      callbacks.get('ITEMS_COL')!(fakeSnap([]));
    });
    expect(result.current.itemsLoading).toBe(false);
  });

  it('unblocks `loading` on a transient expenses-listener error instead of hanging forever', () => {
    const { result } = renderHook(() => useMonthExpenses('g1', '2026-07'));
    expect(result.current.loading).toBe(true);

    act(() => {
      errorCallbacks.get('EXPENSES_COL')!();
    });
    expect(result.current.loading).toBe(false);
  });

  it('unblocks `itemsLoading` on a transient items-listener error instead of hanging forever', () => {
    const { result } = renderHook(() => useMonthExpenses('g1', '2026-07'));
    expect(result.current.itemsLoading).toBe(true);

    act(() => {
      errorCallbacks.get('ITEMS_COL')!();
    });
    expect(result.current.itemsLoading).toBe(false);
  });
});
