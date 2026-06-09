import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { SettlementDoc } from '../src/types/models';

// ---------------------------------------------------------------------------
// Hoisted mocks — captured before any imports touch Firebase.
// ---------------------------------------------------------------------------

let snapshotCallback: ((snap: unknown) => void) | null = null;
const unsubscribe = vi.fn();

const { onSnapshot, query, where, collection } = vi.hoisted(() => ({
  onSnapshot: vi.fn((_q: unknown, cb: (snap: unknown) => void) => {
    snapshotCallback = cb;
    return unsubscribe;
  }),
  query: vi.fn((...args: unknown[]) => ({ _query: args })),
  where: vi.fn((...args: unknown[]) => ({ _where: args })),
  collection: vi.fn((_db: unknown, path: string) => ({ _path: path })),
}));

// ---------------------------------------------------------------------------
// vi.mock calls — must appear before any import of the mocked modules.
// ---------------------------------------------------------------------------

vi.mock('firebase/firestore', () => ({
  onSnapshot: (...args: unknown[]) => onSnapshot(...(args as Parameters<typeof onSnapshot>)),
  query: (...args: unknown[]) => query(...args),
  where: (...args: unknown[]) => where(...args),
  collection: (...args: unknown[]) => collection(...(args as Parameters<typeof collection>)),
  getFirestore: vi.fn(),
}));

vi.mock('../src/lib/firebase', () => ({
  db: { _isMockDb: true },
}));

vi.mock('../src/lib/converters', () => ({
  settlementsCol: (gid: string) => ({ _path: `groups/${gid}/settlements` }),
  incomeCol: (gid: string) => ({ _path: `groups/${gid}/income` }),
  usersCol: {},
  groupsCol: {},
  expensesCol: vi.fn(),
  itemsCol: vi.fn(),
  categoriesCol: vi.fn(),
  invitesCol: vi.fn(),
}));

// Import the hook AFTER mocks are registered.
import { useSettlements } from '../src/hooks/useSettlements';

// ---------------------------------------------------------------------------
// Helper: build a fake Firestore snapshot from SettlementDoc objects.
// ---------------------------------------------------------------------------
function makeSnap(docs: Partial<SettlementDoc>[]) {
  return {
    docs: docs.map((d) => ({ id: d.id ?? 's1', data: () => d })),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSettlements', () => {
  beforeEach(() => {
    snapshotCallback = null;
    vi.clearAllMocks();
    onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      snapshotCallback = cb;
      return unsubscribe;
    });
  });

  it('returns { settlements: [], loading: false } when gid is null', () => {
    const { result } = renderHook(() => useSettlements(null, '2026-06'));

    expect(result.current.settlements).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it('returns loading: true initially before first snapshot', () => {
    const { result } = renderHook(() => useSettlements('g1', '2026-06'));

    expect(result.current.loading).toBe(true);
    expect(result.current.settlements).toEqual([]);
  });

  it('returns loading: false and populates settlements after snapshot fires', () => {
    const { result } = renderHook(() => useSettlements('g1', '2026-06'));

    const settlementDocs: Partial<SettlementDoc>[] = [
      { id: 's1', month: '2026-06', fromUid: 'u1', toUid: 'u2', amount: 15000, paid: false },
      { id: 's2', month: '2026-06', fromUid: 'u2', toUid: 'u3', amount: 8000, paid: true },
    ];

    act(() => {
      snapshotCallback?.(makeSnap(settlementDocs));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.settlements).toHaveLength(2);
    expect(result.current.settlements[0]).toMatchObject({
      id: 's1',
      fromUid: 'u1',
      toUid: 'u2',
      amount: 15000,
    });
    expect(result.current.settlements[1]).toMatchObject({ id: 's2', paid: true });
  });

  it('filters by month', () => {
    renderHook(() => useSettlements('g1', '2026-06'));

    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalled();
    expect(where).toHaveBeenCalledWith('month', '==', '2026-06');
  });

  it('calls unsubscribe on unmount', () => {
    const { unmount } = renderHook(() => useSettlements('g1', '2026-06'));

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
