import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const listeners: { q: unknown; next: (snap: unknown) => void; error: () => void }[] = [];
const unsubscribe = vi.fn();
vi.mock('firebase/firestore', () => ({
  onSnapshot: (q: unknown, next: (snap: unknown) => void, error: () => void) => {
    listeners.push({ q, next, error });
    return unsubscribe;
  },
  query: (...args: unknown[]) => ({ query: args }),
  where: (...args: unknown[]) => ({ where: args }),
  orderBy: (...args: unknown[]) => ({ orderBy: args }),
  collectionGroup: (_db: unknown, id: string) => ({ collectionGroup: id }),
}));
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('../lib/converters', () => ({ expensesCol: (gid: string) => ({ path: `groups/${gid}/expenses` }) }));

import { useTripExpenses } from './useTripExpenses';

const snap = (docs: Record<string, unknown>[]) => ({ docs: docs.map((d) => ({ id: d.id, data: () => d })) });

beforeEach(() => {
  listeners.length = 0;
  unsubscribe.mockClear();
});

describe('useTripExpenses', () => {
  it('loads every expense of the trip and its items, grouped by expense', () => {
    const { result } = renderHook(() => useTripExpenses('japan'));
    expect(result.current.loading).toBe(true);
    expect(listeners[0].q).toEqual({ query: [{ path: 'groups/japan/expenses' }, { orderBy: ['date', 'desc'] }] });
    expect(listeners[1].q).toEqual({ query: [{ collectionGroup: 'items' }, { where: ['groupId', '==', 'japan'] }] });

    act(() => listeners[0].next(snap([{ id: 'e1' }])));
    expect(result.current.loading).toBe(false);
    expect(result.current.itemsLoading).toBe(true);
    act(() => listeners[1].next(snap([{ id: 'i1', expenseId: 'e1' }, { id: 'i2', expenseId: 'e1' }])));
    expect(result.current.itemsLoading).toBe(false);
    expect(result.current.expenses.map((e) => e.id)).toEqual(['e1']);
    expect(result.current.itemsByExpense.e1.map((i) => i.id)).toEqual(['i1', 'i2']);
  });

  it('stops loading on an error instead of spinning', () => {
    const { result } = renderHook(() => useTripExpenses('japan'));
    act(() => { listeners[0].error(); listeners[1].error(); });
    expect(result.current.loading).toBe(false);
    expect(result.current.itemsLoading).toBe(false);
    expect(result.current.error).toBe(true);
  });

  it('loads nothing without a trip, and unsubscribes on unmount', () => {
    const { result, unmount } = renderHook(({ id }) => useTripExpenses(id), { initialProps: { id: null as string | null } });
    expect(listeners).toHaveLength(0);
    expect(result.current.loading).toBe(false);
    unmount();
    const second = renderHook(() => useTripExpenses('japan'));
    second.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });
});
