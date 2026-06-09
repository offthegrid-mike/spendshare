import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ItemDoc } from '../src/types/models';

// ---------------------------------------------------------------------------
// Hoisted mocks — captured before any imports touch Firebase.
// ---------------------------------------------------------------------------

let snapshotCallback: ((snap: unknown) => void) | null = null;
const unsubscribe = vi.fn();

const { onSnapshot, query, where, collectionGroup } = vi.hoisted(() => ({
  onSnapshot: vi.fn((_q: unknown, cb: (snap: unknown) => void) => {
    snapshotCallback = cb;
    return unsubscribe;
  }),
  query: vi.fn((...args: unknown[]) => ({ _query: args })),
  where: vi.fn((...args: unknown[]) => ({ _where: args })),
  collectionGroup: vi.fn((_db: unknown, name: string) => ({ _collectionGroup: name })),
}));

// ---------------------------------------------------------------------------
// vi.mock calls — must appear before any import of the mocked modules.
// ---------------------------------------------------------------------------

vi.mock('firebase/firestore', () => ({
  onSnapshot: (...args: unknown[]) => onSnapshot(...(args as Parameters<typeof onSnapshot>)),
  query: (...args: unknown[]) => query(...args),
  where: (...args: unknown[]) => where(...args),
  collectionGroup: (...args: unknown[]) =>
    collectionGroup(...(args as Parameters<typeof collectionGroup>)),
  getFirestore: vi.fn(),
}));

vi.mock('../src/lib/firebase', () => ({
  db: { _isMockDb: true },
}));

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

// Import the hook AFTER mocks are registered.
import { useMonthItems } from '../src/hooks/useMonthItems';

// ---------------------------------------------------------------------------
// Helper: build a fake Firestore snapshot from an array of ItemDoc objects.
// ---------------------------------------------------------------------------
function makeSnap(docs: Partial<ItemDoc>[]) {
  return {
    docs: docs.map((d) => ({ id: d.id ?? 'i1', data: () => d })),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useMonthItems', () => {
  beforeEach(() => {
    snapshotCallback = null;
    vi.clearAllMocks();
    onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      snapshotCallback = cb;
      return unsubscribe;
    });
  });

  it('returns { items: [], loading: false } when gid is null', () => {
    const { result } = renderHook(() => useMonthItems(null, '2026-06'));

    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it('returns loading: true initially before first snapshot', () => {
    const { result } = renderHook(() => useMonthItems('g1', '2026-06'));

    expect(result.current.loading).toBe(true);
    expect(result.current.items).toEqual([]);
  });

  it('returns loading: false and populates items after snapshot fires', () => {
    const { result } = renderHook(() => useMonthItems('g1', '2026-06'));

    const itemDocs: Partial<ItemDoc>[] = [
      {
        id: 'i1',
        groupId: 'g1',
        expenseId: 'e1',
        month: '2026-06',
        name: 'Groceries',
        categoryId: 'c1',
        category: 'Food',
        amount: 5000,
        shared: true,
        payerUid: 'u1',
      },
      {
        id: 'i2',
        groupId: 'g1',
        expenseId: 'e1',
        month: '2026-06',
        name: 'Coffee',
        categoryId: 'c2',
        category: 'Drinks',
        amount: 1000,
        shared: false,
        payerUid: 'u2',
      },
    ];

    act(() => {
      snapshotCallback?.(makeSnap(itemDocs));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0]).toMatchObject({ id: 'i1', name: 'Groceries', amount: 5000 });
    expect(result.current.items[1]).toMatchObject({ id: 'i2', name: 'Coffee', amount: 1000 });
  });

  it('uses collectionGroup with "items", filtered by groupId and month', () => {
    renderHook(() => useMonthItems('g1', '2026-06'));

    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(collectionGroup).toHaveBeenCalledWith(expect.anything(), 'items');
    expect(query).toHaveBeenCalled();
    expect(where).toHaveBeenCalledWith('groupId', '==', 'g1');
    expect(where).toHaveBeenCalledWith('month', '==', '2026-06');
  });

  it('calls unsubscribe on unmount', () => {
    const { unmount } = renderHook(() => useMonthItems('g1', '2026-06'));

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
