import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { IncomeDoc } from '../src/types/models';

// ---------------------------------------------------------------------------
// Hoisted mocks — captured before any imports touch Firebase.
// ---------------------------------------------------------------------------

// We capture the onSnapshot callback so we can drive snapshots manually.
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

// Mock converters so incomeCol returns a predictable ref without touching real Firebase.
vi.mock('../src/lib/converters', () => ({
  incomeCol: (gid: string) => ({ _path: `groups/${gid}/income` }),
  // Provide stubs for other exports so the module resolves without errors.
  usersCol: {},
  groupsCol: {},
  expensesCol: vi.fn(),
  itemsCol: vi.fn(),
  categoriesCol: vi.fn(),
  invitesCol: vi.fn(),
  settlementsCol: vi.fn(),
}));

// Import the hook AFTER mocks are registered.
import { useIncome } from '../src/hooks/useIncome';

// ---------------------------------------------------------------------------
// Helper: build a fake Firestore snapshot from an array of IncomeDoc objects.
// ---------------------------------------------------------------------------
function makeSnap(docs: (IncomeDoc & { id?: string })[]) {
  return {
    docs: docs.map((d) => ({
      id: d.uid, // use uid as document id
      data: () => ({ uid: d.uid, month: d.month, amount: d.amount }),
    })),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useIncome', () => {
  beforeEach(() => {
    snapshotCallback = null;
    vi.clearAllMocks();
    // Re-register onSnapshot mock after clearAllMocks (clearAllMocks resets mock implementations).
    onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      snapshotCallback = cb;
      return unsubscribe;
    });
  });

  it('returns { income: [], loading: false } when gid is null', () => {
    const { result } = renderHook(() => useIncome(null, '2026-06'));

    expect(result.current.income).toEqual([]);
    expect(result.current.loading).toBe(false);
    // onSnapshot must NOT be called when there is no gid
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it('returns loading: true initially before the first snapshot fires', () => {
    const { result } = renderHook(() => useIncome('g1', '2026-06'));

    // onSnapshot subscribed but callback not yet called
    expect(result.current.loading).toBe(true);
    expect(result.current.income).toEqual([]);
  });

  it('returns loading: false and populates income after the snapshot fires', () => {
    const { result } = renderHook(() => useIncome('g1', '2026-06'));

    const incomeDocs: IncomeDoc[] = [
      { uid: 'u1', month: '2026-06', amount: 500000 },
      { uid: 'u2', month: '2026-06', amount: 300000 },
    ];

    act(() => {
      snapshotCallback?.(makeSnap(incomeDocs));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.income).toHaveLength(2);
    expect(result.current.income[0]).toMatchObject({ uid: 'u1', month: '2026-06', amount: 500000 });
    expect(result.current.income[1]).toMatchObject({ uid: 'u2', month: '2026-06', amount: 300000 });
  });

  it('subscribes with a query filtered by the selected month', () => {
    renderHook(() => useIncome('g1', '2026-06'));

    expect(onSnapshot).toHaveBeenCalledTimes(1);
    // query() should have been called (wrapping the collection ref + where clause)
    expect(query).toHaveBeenCalled();
    // where() should filter on 'month'
    expect(where).toHaveBeenCalledWith('month', '==', '2026-06');
  });

  it('replaces income data when the month changes', () => {
    const { result, rerender } = renderHook(
      ({ gid, month }: { gid: string; month: string }) => useIncome(gid, month),
      { initialProps: { gid: 'g1', month: '2026-05' } },
    );

    // Fire a snapshot for May
    act(() => {
      snapshotCallback?.(makeSnap([{ uid: 'u1', month: '2026-05', amount: 400000 }]));
    });
    expect(result.current.income[0].month).toBe('2026-05');

    // Change month to June — hook re-subscribes; new callback registered
    rerender({ gid: 'g1', month: '2026-06' });

    // Before the new snapshot fires, data should be empty (or stale — loading resets)
    // The unsubscribe for May should have been called
    expect(unsubscribe).toHaveBeenCalled();

    // Fire a snapshot for June
    act(() => {
      snapshotCallback?.(makeSnap([{ uid: 'u1', month: '2026-06', amount: 500000 }]));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.income).toHaveLength(1);
    expect(result.current.income[0].month).toBe('2026-06');
    expect(result.current.income[0].amount).toBe(500000);
  });

  it('calls unsubscribe when the component unmounts', () => {
    const { unmount } = renderHook(() => useIncome('g1', '2026-06'));

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
