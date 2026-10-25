import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HISTORY_TTL_MS, clearGroupHistory, invalidateGroupHistory, useAllExpenses } from './useAllExpenses';

const { getDocsMock } = vi.hoisted(() => ({ getDocsMock: vi.fn() }));

vi.mock('../lib/converters', () => ({ expensesCol: () => 'EXPENSES_COL' }));
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  query: (base: string) => base,
  where: () => ({}),
  orderBy: () => ({}),
  collectionGroup: () => 'ITEMS_COL',
  getDocs: (q: string) => getDocsMock(q),
}));

function fakeSnap(docs: Array<Record<string, unknown>>) {
  return { docs: docs.map((data) => ({ data: () => data, id: data.id as string })) };
}

describe('useAllExpenses', () => {
  beforeEach(() => {
    getDocsMock.mockReset();
    clearGroupHistory();
  });

  it('fetches every expense for the group with no month filter', async () => {
    getDocsMock.mockImplementation((q: string) =>
      Promise.resolve(
        q === 'EXPENSES_COL'
          ? fakeSnap([{ id: 'e1', month: '2026-01' }, { id: 'e2', month: '2026-06' }])
          : fakeSnap([]),
      ),
    );

    const { result } = renderHook(() => useAllExpenses('g1'));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.expenses.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(result.current.error).toBeNull();
  });

  it('groups items by their expense id', async () => {
    getDocsMock.mockImplementation((q: string) =>
      Promise.resolve(
        q === 'EXPENSES_COL'
          ? fakeSnap([{ id: 'e1' }])
          : fakeSnap([
              { id: 'i1', expenseId: 'e1', name: 'Milk' },
              { id: 'i2', expenseId: 'e1', name: 'Bread' },
            ]),
      ),
    );

    const { result } = renderHook(() => useAllExpenses('g1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.itemsByExpense.e1.map((i) => i.name)).toEqual(['Milk', 'Bread']);
  });

  // One query is rejected at a time rather than both: vitest's mock-result
  // tracking reports the second rejection of a Promise.all as unhandled, which
  // plain Node does not do.
  it('surfaces an error instead of loading forever when the expense fetch fails', async () => {
    getDocsMock.mockImplementation((q: string) =>
      q === 'EXPENSES_COL'
        ? Promise.reject(new Error('permission-denied'))
        : Promise.resolve(fakeSnap([])),
    );

    const { result } = renderHook(() => useAllExpenses('g1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/could not load/i);
  });

  it('surfaces an error when the item fetch fails', async () => {
    getDocsMock.mockImplementation((q: string) =>
      q === 'ITEMS_COL'
        ? Promise.reject(new Error('permission-denied'))
        : Promise.resolve(fakeSnap([])),
    );

    const { result } = renderHook(() => useAllExpenses('g1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/could not load/i);
  });

  it('does not fetch without a group', async () => {
    const { result } = renderHook(() => useAllExpenses(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  describe('shared copy', () => {
    function serveHistory() {
      getDocsMock.mockImplementation((q: string) =>
        Promise.resolve(q === 'EXPENSES_COL' ? fakeSnap([{ id: 'e1' }]) : fakeSnap([{ id: 'i1', expenseId: 'e1', name: 'Milk' }])),
      );
    }

    async function loadOnce(gid: string, opts?: { fresh?: boolean }) {
      const hook = renderHook(() => useAllExpenses(gid, opts));
      await waitFor(() => expect(hook.result.current.loading).toBe(false));
      return hook;
    }

    it('reuses the copy on a later mount instead of fetching again', async () => {
      serveHistory();
      (await loadOnce('g1')).unmount();
      expect(getDocsMock).toHaveBeenCalledTimes(2);

      const { result } = await loadOnce('g1');
      expect(getDocsMock).toHaveBeenCalledTimes(2);
      expect(result.current.expenses.map((e) => e.id)).toEqual(['e1']);
      expect(result.current.itemsByExpense.e1.map((i) => i.name)).toEqual(['Milk']);
    });

    it('fetches again with fresh, and the new data replaces the copy', async () => {
      serveHistory();
      (await loadOnce('g1')).unmount();
      getDocsMock.mockImplementation((q: string) =>
        Promise.resolve(q === 'EXPENSES_COL' ? fakeSnap([{ id: 'e1' }, { id: 'e2' }]) : fakeSnap([])),
      );

      const fresh = await loadOnce('g1', { fresh: true });
      expect(getDocsMock).toHaveBeenCalledTimes(4);
      expect(fresh.result.current.expenses.map((e) => e.id)).toEqual(['e1', 'e2']);
      fresh.unmount();

      const later = await loadOnce('g1');
      expect(getDocsMock).toHaveBeenCalledTimes(4);
      expect(later.result.current.expenses.map((e) => e.id)).toEqual(['e1', 'e2']);
    });

    it('fetches again after the copy is invalidated', async () => {
      serveHistory();
      (await loadOnce('g1')).unmount();
      invalidateGroupHistory('g1');
      await loadOnce('g1');
      expect(getDocsMock).toHaveBeenCalledTimes(4);
    });

    it('fetches again once the copy has expired', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        serveHistory();
        (await loadOnce('g1')).unmount();
        vi.advanceTimersByTime(HISTORY_TTL_MS + 1);
        await loadOnce('g1');
        expect(getDocsMock).toHaveBeenCalledTimes(4);
      } finally {
        vi.useRealTimers();
      }
    });

    it('keeps a copy per group', async () => {
      serveHistory();
      (await loadOnce('g1')).unmount();
      await loadOnce('g2');
      expect(getDocsMock).toHaveBeenCalledTimes(4);
    });

    // Each load's expense query waits until the test resolves it with expense ids.
    function deferLoads() {
      const loads: Array<{ resolve: (ids: string[]) => void }> = [];
      getDocsMock.mockImplementation((q: string) =>
        q === 'ITEMS_COL'
          ? Promise.resolve(fakeSnap([]))
          : new Promise((done) => loads.push({ resolve: (ids) => done(fakeSnap(ids.map((id) => ({ id })))) })),
      );
      return loads;
    }

    it('delivers a shared copy asynchronously, never inside the effect', async () => {
      serveHistory();
      (await loadOnce('g1')).unmount();
      const { result } = renderHook(() => useAllExpenses('g1'));
      expect(result.current.loading).toBe(true);
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(getDocsMock).toHaveBeenCalledTimes(2);
    });

    it('does not keep a load that finished after the copy was invalidated', async () => {
      const loads = deferLoads();
      const first = renderHook(() => useAllExpenses('g1'));
      invalidateGroupHistory('g1'); // a save lands while the load is in flight
      await act(async () => loads[0].resolve(['old']));
      first.unmount();

      const second = renderHook(() => useAllExpenses('g1'));
      expect(loads).toHaveLength(2);
      await act(async () => loads[1].resolve(['old', 'saved']));
      expect(second.result.current.expenses.map((e) => e.id)).toEqual(['old', 'saved']);
    });

    it('shares a load already in flight instead of starting another', async () => {
      const loads = deferLoads();
      const a = renderHook(() => useAllExpenses('g1'));
      const b = renderHook(() => useAllExpenses('g1'));
      expect(loads).toHaveLength(1);
      await act(async () => loads[0].resolve(['e1']));
      expect(a.result.current.expenses.map((e) => e.id)).toEqual(['e1']);
      expect(b.result.current.expenses.map((e) => e.id)).toEqual(['e1']);
    });

    it('keeps a fresh load over an older normal one that finishes later', async () => {
      const loads = deferLoads();
      const normal = renderHook(() => useAllExpenses('g1'));
      const fresh = renderHook(() => useAllExpenses('g1', { fresh: true }));
      expect(loads).toHaveLength(2);
      await act(async () => loads[1].resolve(['fresh']));
      await act(async () => loads[0].resolve(['stale']));
      normal.unmount();
      fresh.unmount();

      const later = renderHook(() => useAllExpenses('g1'));
      await waitFor(() => expect(later.result.current.loading).toBe(false));
      expect(loads).toHaveLength(2);
      expect(later.result.current.expenses.map((e) => e.id)).toEqual(['fresh']);
    });

    it('reports loading again when fresh is turned on for the same group', async () => {
      serveHistory();
      const { result, rerender } = renderHook(({ fresh }) => useAllExpenses('g1', { fresh }), { initialProps: { fresh: false } });
      await waitFor(() => expect(result.current.loading).toBe(false));
      rerender({ fresh: true });
      expect(result.current.loading).toBe(true);
      await waitFor(() => expect(result.current.loading).toBe(false));
    });

    it('clearGroupHistory forgets every group', async () => {
      serveHistory();
      (await loadOnce('g1')).unmount();
      (await loadOnce('g2')).unmount();
      clearGroupHistory();
      (await loadOnce('g1')).unmount();
      (await loadOnce('g2')).unmount();
      expect(getDocsMock).toHaveBeenCalledTimes(8);
    });

    it('does not keep a failed load', async () => {
      getDocsMock.mockImplementation((q: string) =>
        q === 'EXPENSES_COL' ? Promise.reject(new Error('offline')) : Promise.resolve(fakeSnap([])),
      );
      (await loadOnce('g1')).unmount();
      serveHistory();
      const { result } = await loadOnce('g1');
      expect(getDocsMock).toHaveBeenCalledTimes(4);
      expect(result.current.error).toBeNull();
    });
  });
});
