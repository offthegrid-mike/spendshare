import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAllExpenses } from './useAllExpenses';

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
  beforeEach(() => getDocsMock.mockReset());

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
});
