import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRefunds } from './useRefunds';

type Listener = { next: (snap: unknown) => void; error: (err: Error) => void; unsubscribe: () => void };

const { listeners, wheres } = vi.hoisted(() => ({ listeners: [] as Listener[], wheres: [] as unknown[][] }));

vi.mock('../lib/converters', () => ({ expensesCol: (gid: string) => `groups/${gid}/expenses` }));
vi.mock('firebase/firestore', () => ({
  query: (base: string) => base,
  where: (...args: unknown[]) => { wheres.push(args); return {}; },
  onSnapshot: (_q: unknown, next: Listener['next'], error: Listener['error']) => {
    const listener = { next, error, unsubscribe: vi.fn() };
    listeners.push(listener);
    return listener.unsubscribe;
  },
}));

const snap = (docs: Array<Record<string, unknown>>) => ({ docs: docs.map((d) => ({ id: d.id, data: () => d })) });
const latest = () => listeners[listeners.length - 1];

beforeEach(() => {
  listeners.length = 0;
  wheres.length = 0;
});

describe('useRefunds', () => {
  it('listens for the refunds made from an expense', () => {
    const { result } = renderHook(() => useRefunds('g1', 'e1'));
    expect(result.current.loading).toBe(true);
    act(() => latest().next(snap([{ id: 'r1', total: 500, kind: 'refund', refundOf: 'e1' }])));
    expect(wheres).toEqual([['refundOf', '==', 'e1']]);
    expect(result.current.loading).toBe(false);
    expect(result.current.refunds.map((r) => r.id)).toEqual(['r1']);
  });

  it('follows refunds added or deleted later', () => {
    const { result } = renderHook(() => useRefunds('g1', 'e1'));
    act(() => latest().next(snap([{ id: 'r1', total: 500 }])));
    act(() => latest().next(snap([])));
    expect(result.current.refunds).toEqual([]);
  });

  it("never shows another expense's refunds while the next one loads", () => {
    const { result, rerender } = renderHook(({ id }) => useRefunds('g1', id), { initialProps: { id: 'e1' } });
    act(() => latest().next(snap([{ id: 'r1', total: 500 }])));
    rerender({ id: 'e2' });
    expect(result.current).toEqual({ refunds: [], loading: true, error: false });
  });

  it('loads nothing without an expense', () => {
    const { result } = renderHook(() => useRefunds('g1', undefined));
    expect(result.current).toEqual({ refunds: [], loading: false, error: false });
    expect(listeners).toHaveLength(0);
  });

  it('reports a failed load', () => {
    const { result } = renderHook(() => useRefunds('g1', 'e1'));
    act(() => latest().error(new Error('offline')));
    expect(result.current).toEqual({ refunds: [], loading: false, error: true });
  });

  it('stops listening on unmount', () => {
    const { unmount } = renderHook(() => useRefunds('g1', 'e1'));
    const listener = latest();
    unmount();
    expect(listener.unsubscribe).toHaveBeenCalled();
  });
});
