import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    items: [] as Array<Record<string, unknown>>,
    itemsLoading: true,
    wheres: [] as Array<[string, string, unknown]>,
    onNext: null as null | ((snap: unknown) => void),
    onError: null as null | (() => void),
  },
}));

vi.mock('./useYearItems', () => ({
  useYearItems: () => ({ items: state.items, loading: state.itemsLoading }),
}));
vi.mock('../lib/converters', () => ({ settlementsCol: () => 'SETTLEMENTS' }));
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

import { useYearOverview } from './useYearOverview';

const snap = (docs: Array<Record<string, unknown>>) => ({ docs: docs.map((d) => ({ data: () => d })) });
const members = ['mike', 'priya'];

beforeEach(() => {
  state.items = [];
  state.itemsLoading = true;
  state.wheres = [];
  state.onNext = null;
  state.onError = null;
});

describe('useYearOverview', () => {
  it("queries the year's settlements by month range", () => {
    renderHook(() => useYearOverview('g1', '2026', members));
    expect(state.wheres).toEqual([
      ['month', '>=', '2026-01'],
      ['month', '<=', '2026-12'],
    ]);
  });

  it('is loading until both items and settlements have arrived', () => {
    const { result, rerender } = renderHook(() => useYearOverview('g1', '2026', members));
    expect(result.current.loading).toBe(true);
    act(() => state.onNext!(snap([])));
    expect(result.current.loading).toBe(true);
    state.itemsLoading = false;
    rerender();
    expect(result.current.loading).toBe(false);
  });

  it('summarises each month: spent, and the balance after paid settlements', () => {
    state.itemsLoading = false;
    state.items = [
      { month: '2026-09', amount: 1000, shared: true, payerUid: 'mike' },
      { month: '2026-09', amount: 500, shared: false, payerUid: 'priya' },
      { month: '2026-10', amount: 2000, shared: true, payerUid: 'mike' },
    ];
    const { result } = renderHook(() => useYearOverview('g1', '2026', members));
    act(() => state.onNext!(snap([
      { id: 's', month: '2026-09', fromUid: 'priya', toUid: 'mike', amount: 500, paid: true },
    ])));
    const { months, total } = result.current;
    expect(months['2026-09'].spent).toBe(1500);
    expect(months['2026-09'].summary.balance.mike).toBe(0);
    expect(months['2026-10'].summary.balance.mike).toBe(1000);
    expect(total).toBe(3500);
  });

  it('stops loading if the settlements query fails', () => {
    state.itemsLoading = false;
    const { result } = renderHook(() => useYearOverview('g1', '2026', members));
    act(() => state.onError!());
    expect(result.current.loading).toBe(false);
  });
});

describe('useYearOverview with refunds', () => {
  it('takes refunds off each month and the year', () => {
    state.itemsLoading = false;
    state.items = [
      { month: '2026-10', amount: 2000, shared: true, payerUid: 'mike' },
      { month: '2026-10', amount: 500, shared: true, payerUid: 'mike', refund: true },
    ];
    const { result } = renderHook(() => useYearOverview('g1', '2026', members));
    act(() => state.onNext!(snap([])));
    expect(result.current.months['2026-10'].spent).toBe(1500);
    expect(result.current.total).toBe(1500);
  });
});
