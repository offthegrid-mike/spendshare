import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useYearItems } from './useYearItems';

const { state } = vi.hoisted(() => ({
  state: {
    wheres: [] as Array<[string, string, unknown]>,
    onNext: null as null | ((snap: unknown) => void),
    onError: null as null | (() => void),
  },
}));

vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collectionGroup: () => 'ITEMS_COL',
  where: (field: string, op: string, value: unknown) => {
    state.wheres.push([field, op, value]);
    return {};
  },
  query: (base: string) => base,
  onSnapshot: (_q: string, next: (snap: unknown) => void, err?: () => void) => {
    state.onNext = next;
    state.onError = err ?? null;
    return () => {};
  },
}));

function fakeSnap(docs: Array<Record<string, unknown>>) {
  return { docs: docs.map((data) => ({ data: () => data, id: (data.id as string) ?? 'id' })) };
}

describe('useYearItems', () => {
  beforeEach(() => {
    state.wheres = [];
    state.onNext = null;
    state.onError = null;
  });

  it('queries items for the group across the whole year', () => {
    renderHook(() => useYearItems('g1', '2026'));
    expect(state.wheres).toEqual([
      ['groupId', '==', 'g1'],
      ['month', '>=', '2026-01'],
      ['month', '<=', '2026-12'],
    ]);
  });

  it('is loading until the first snapshot, then returns items', () => {
    const { result } = renderHook(() => useYearItems('g1', '2026'));
    expect(result.current.loading).toBe(true);
    act(() => state.onNext!(fakeSnap([{ id: 'i1', month: '2026-02', amount: 100 }])));
    expect(result.current.loading).toBe(false);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe('i1');
  });

  it('goes back to loading when the year changes', () => {
    const { result, rerender } = renderHook(({ year }) => useYearItems('g1', year), {
      initialProps: { year: '2026' },
    });
    act(() => state.onNext!(fakeSnap([])));
    expect(result.current.loading).toBe(false);
    rerender({ year: '2025' });
    expect(result.current.loading).toBe(true);
  });

  it('unblocks loading on a listener error', () => {
    const { result } = renderHook(() => useYearItems('g1', '2026'));
    act(() => state.onError!());
    expect(result.current.loading).toBe(false);
  });

  it('is not loading and does not subscribe without a group', () => {
    const { result } = renderHook(() => useYearItems(null, '2026'));
    expect(result.current.loading).toBe(false);
    expect(state.onNext).toBeNull();
  });
});
