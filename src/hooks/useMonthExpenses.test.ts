import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMonthExpenses } from './useMonthExpenses';

const { callbacks } = vi.hoisted(() => ({
  callbacks: new Map<string, (snap: unknown) => void>(),
}));

vi.mock('../lib/converters', () => ({ expensesCol: () => 'EXPENSES_COL' }));
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  query: (base: string) => base,
  where: () => ({}),
  orderBy: () => ({}),
  collectionGroup: () => 'ITEMS_COL',
  onSnapshot: (q: string, cb: (snap: unknown) => void) => {
    callbacks.set(q, cb);
    return () => callbacks.delete(q);
  },
}));

function fakeSnap(docs: Array<Record<string, unknown>>) {
  return { docs: docs.map((data) => ({ data: () => data, id: (data.id as string) ?? 'id' })) };
}

describe('useMonthExpenses', () => {
  beforeEach(() => {
    callbacks.clear();
  });

  it('stays loading until both the expenses and items snapshots have fired', () => {
    const { result } = renderHook(() => useMonthExpenses('g1', '2026-07'));
    expect(result.current.loading).toBe(true);

    // Expenses snapshot arrives first (as it does in production) — items
    // haven't loaded yet, so callers must keep waiting.
    act(() => {
      callbacks.get('EXPENSES_COL')!(fakeSnap([{ id: 'e1', month: '2026-07' }]));
    });
    expect(result.current.expenses.length).toBe(1);
    expect(result.current.loading).toBe(true);

    // Items snapshot finally arrives — now it's safe to render.
    act(() => {
      callbacks.get('ITEMS_COL')!(fakeSnap([]));
    });
    expect(result.current.loading).toBe(false);
  });

  it('is not loading once both snapshots have fired, regardless of order', () => {
    const { result } = renderHook(() => useMonthExpenses('g1', '2026-07'));

    act(() => {
      callbacks.get('ITEMS_COL')!(fakeSnap([]));
    });
    expect(result.current.loading).toBe(true);

    act(() => {
      callbacks.get('EXPENSES_COL')!(fakeSnap([]));
    });
    expect(result.current.loading).toBe(false);
  });
});
