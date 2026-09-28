import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useYearIncome } from './useYearIncome';

const { state } = vi.hoisted(() => ({
  state: {
    wheres: [] as Array<[string, string, unknown]>,
    onNext: null as null | ((snap: unknown) => void),
    onError: null as null | (() => void),
  },
}));

vi.mock('../lib/converters', () => ({ incomeCol: () => 'INCOME_COL' }));
vi.mock('firebase/firestore', () => ({
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

describe('useYearIncome', () => {
  beforeEach(() => {
    state.wheres = [];
    state.onNext = null;
    state.onError = null;
  });

  it('queries income across the whole year', () => {
    renderHook(() => useYearIncome('g1', '2026'));
    expect(state.wheres).toEqual([
      ['month', '>=', '2026-01'],
      ['month', '<=', '2026-12'],
    ]);
  });

  it('is loading until the first snapshot, then returns income with ids', () => {
    const { result } = renderHook(() => useYearIncome('g1', '2026'));
    expect(result.current.loading).toBe(true);
    act(() => state.onNext!(fakeSnap([{ id: 'n1', uid: 'u1', month: '2026-04', amount: 500 }])));
    expect(result.current.loading).toBe(false);
    expect(result.current.income).toEqual([{ id: 'n1', uid: 'u1', month: '2026-04', amount: 500 }]);
  });

  it('goes back to loading when the year changes', () => {
    const { result, rerender } = renderHook(({ year }) => useYearIncome('g1', year), {
      initialProps: { year: '2026' },
    });
    act(() => state.onNext!(fakeSnap([])));
    expect(result.current.loading).toBe(false);
    rerender({ year: '2025' });
    expect(result.current.loading).toBe(true);
  });

  it('unblocks loading on a listener error', () => {
    const { result } = renderHook(() => useYearIncome('g1', '2026'));
    act(() => state.onError!());
    expect(result.current.loading).toBe(false);
  });

  it('is not loading and does not subscribe without a group', () => {
    const { result } = renderHook(() => useYearIncome(null, '2026'));
    expect(result.current.loading).toBe(false);
    expect(state.onNext).toBeNull();
  });
});
