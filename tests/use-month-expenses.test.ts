import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ExpenseDoc, ItemDoc } from '../src/types/models';

// ---------------------------------------------------------------------------
// Hoisted mocks — captured before any imports touch Firebase.
// useMonthExpenses opens TWO onSnapshot subscriptions (expenses, then items),
// so we capture each callback in call order: callbacks[0] = expenses,
// callbacks[1] = items.
// ---------------------------------------------------------------------------

let callbacks: ((snap: unknown) => void)[] = [];
const unsubscribe = vi.fn();

const { onSnapshot, query, where, orderBy, collectionGroup } = vi.hoisted(() => ({
  onSnapshot: vi.fn((_q: unknown, cb: (snap: unknown) => void) => {
    callbacks.push(cb);
    return unsubscribe;
  }),
  query: vi.fn((...args: unknown[]) => ({ _query: args })),
  where: vi.fn((...args: unknown[]) => ({ _where: args })),
  orderBy: vi.fn((...args: unknown[]) => ({ _orderBy: args })),
  collectionGroup: vi.fn((_db: unknown, name: string) => ({ _collectionGroup: name })),
}));

vi.mock('firebase/firestore', () => ({
  onSnapshot: (...args: unknown[]) => onSnapshot(...(args as Parameters<typeof onSnapshot>)),
  query: (...args: unknown[]) => query(...args),
  where: (...args: unknown[]) => where(...args),
  orderBy: (...args: unknown[]) => orderBy(...args),
  collectionGroup: (...args: unknown[]) =>
    collectionGroup(...(args as Parameters<typeof collectionGroup>)),
  getFirestore: vi.fn(),
}));

vi.mock('../src/lib/firebase', () => ({ db: { _isMockDb: true } }));

vi.mock('../src/lib/converters', () => ({
  expensesCol: (gid: string) => ({ _path: `groups/${gid}/expenses` }),
  itemsCol: vi.fn(),
}));

import { useMonthExpenses } from '../src/hooks/useMonthExpenses';

function expSnap(docs: Partial<ExpenseDoc>[]) {
  return { docs: docs.map((d) => ({ id: d.id ?? 'e1', data: () => d })) };
}
function itemSnap(docs: Partial<ItemDoc>[]) {
  return { docs: docs.map((d) => ({ id: d.id ?? 'i1', data: () => d })) };
}

describe('useMonthExpenses itemsLoaded', () => {
  beforeEach(() => {
    callbacks = [];
    vi.clearAllMocks();
    onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      callbacks.push(cb);
      return unsubscribe;
    });
  });

  it('starts with itemsLoaded false before any snapshot fires', () => {
    const { result } = renderHook(() => useMonthExpenses('g1', '2026-07'));
    expect(result.current.itemsLoaded).toBe(false);
  });

  it('keeps itemsLoaded false when only the expenses snapshot has fired (the race)', () => {
    const { result } = renderHook(() => useMonthExpenses('g1', '2026-07'));
    // Fire ONLY the expenses subscription (callbacks[0]).
    act(() => {
      callbacks[0]?.(expSnap([{ id: 'e1', month: '2026-07' }]));
    });
    expect(result.current.expenses).toHaveLength(1);
    expect(result.current.itemsLoaded).toBe(false);
  });

  it('sets itemsLoaded true once the items snapshot fires and groups items by expenseId', () => {
    const { result } = renderHook(() => useMonthExpenses('g1', '2026-07'));
    act(() => {
      callbacks[0]?.(expSnap([{ id: 'e1', month: '2026-07' }]));
    });
    act(() => {
      callbacks[1]?.(
        itemSnap([
          { id: 'i1', expenseId: 'e1', name: 'Cherry', amount: 300 },
          { id: 'i2', expenseId: 'e1', name: 'Milk 2L', amount: 420 },
        ]),
      );
    });
    expect(result.current.itemsLoaded).toBe(true);
    expect(result.current.itemsByExpense['e1']).toHaveLength(2);
  });
});
