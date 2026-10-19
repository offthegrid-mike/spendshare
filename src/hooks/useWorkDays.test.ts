import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkDays } from './useWorkDays';

const { callbacks, errorCallbacks, queryCalls } = vi.hoisted(() => ({
  callbacks: new Map<string, (snap: unknown) => void>(),
  errorCallbacks: new Map<string, () => void>(),
  queryCalls: [] as Array<{ base: string; clauses: unknown[] }>,
}));

vi.mock('../lib/converters', () => ({ workDaysCol: (uid: string) => `WORK_DAYS_COL:${uid}` }));
vi.mock('firebase/firestore', () => ({
  query: (base: string, ...clauses: unknown[]) => {
    queryCalls.push({ base, clauses });
    return base;
  },
  where: (field: string, op: string, value: string) => ({ field, op, value }),
  documentId: () => 'DOC_ID',
  onSnapshot: (q: string, cb: (snap: unknown) => void, onError?: () => void) => {
    callbacks.set(q, cb);
    if (onError) errorCallbacks.set(q, onError);
    return () => callbacks.delete(q);
  },
}));

function fakeSnap(docs: Array<{ id: string; data?: Record<string, unknown> }>) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data ?? {} })) };
}

describe('useWorkDays', () => {
  beforeEach(() => {
    callbacks.clear();
    errorCallbacks.clear();
    queryCalls.length = 0;
  });

  it('is loading until the first snapshot arrives', () => {
    const { result } = renderHook(() => useWorkDays('u1', '2026-27'));
    expect(result.current.loading).toBe(true);
    expect(result.current.days).toEqual([]);

    act(() => {
      callbacks.get('WORK_DAYS_COL:u1')!(fakeSnap([{ id: '2026-07-01', data: { type: 'home' } }]));
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.days).toHaveLength(1);
  });

  it('returns the days ascending by date, with the date taken from the document id', () => {
    const { result } = renderHook(() => useWorkDays('u1', '2026-27'));

    act(() => {
      callbacks.get('WORK_DAYS_COL:u1')!(
        fakeSnap([
          { id: '2026-09-15', data: { type: 'office' } },
          { id: '2026-07-03', data: { type: 'home' } },
          { id: '2027-02-01', data: { date: 'wrong', type: 'leave' } },
        ]),
      );
    });

    expect(result.current.days.map((d) => d.date)).toEqual(['2026-07-03', '2026-09-15', '2027-02-01']);
    expect(result.current.days.map((d) => d.type)).toEqual(['home', 'office', 'leave']);
  });

  it('queries the document-id range of the income year', () => {
    renderHook(() => useWorkDays('u1', '2026-27'));

    expect(queryCalls).toHaveLength(1);
    expect(queryCalls[0].base).toBe('WORK_DAYS_COL:u1');
    expect(queryCalls[0].clauses).toEqual([
      { field: 'DOC_ID', op: '>=', value: '2026-07-01' },
      { field: 'DOC_ID', op: '<=', value: '2027-06-30' },
    ]);
  });

  it('clears the days and loads again when the income year changes', () => {
    const { result, rerender } = renderHook(({ year }) => useWorkDays('u1', year), {
      initialProps: { year: '2026-27' },
    });
    act(() => {
      callbacks.get('WORK_DAYS_COL:u1')!(fakeSnap([{ id: '2026-07-01', data: { type: 'home' } }]));
    });
    expect(result.current.days).toHaveLength(1);
    expect(result.current.loading).toBe(false);

    rerender({ year: '2027-28' });
    expect(result.current.days).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(queryCalls.at(-1)!.clauses).toEqual([
      { field: 'DOC_ID', op: '>=', value: '2027-07-01' },
      { field: 'DOC_ID', op: '<=', value: '2028-06-30' },
    ]);

    act(() => {
      callbacks.get('WORK_DAYS_COL:u1')!(fakeSnap([{ id: '2027-07-02', data: { type: 'office' } }]));
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.days.map((d) => d.date)).toEqual(['2027-07-02']);
  });

  it('is loading again, with no days, when the income year steps from A to B and back to A before B arrives', () => {
    const { result, rerender } = renderHook(({ year }) => useWorkDays('u1', year), {
      initialProps: { year: '2026-27' },
    });
    act(() => {
      callbacks.get('WORK_DAYS_COL:u1')!(fakeSnap([{ id: '2026-07-01', data: { type: 'home' } }]));
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.days).toHaveLength(1);

    // B never delivers a snapshot before the screen goes back to A.
    rerender({ year: '2027-28' });
    rerender({ year: '2026-27' });
    expect(result.current.loading).toBe(true);
    expect(result.current.days).toEqual([]);

    // A's new listener then loads as normal.
    act(() => {
      callbacks.get('WORK_DAYS_COL:u1')!(fakeSnap([{ id: '2026-07-02', data: { type: 'office' } }]));
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.days.map((d) => d.date)).toEqual(['2026-07-02']);
  });

  it('clears the days and loads again when the user changes', () => {
    const { result, rerender } = renderHook(({ uid }) => useWorkDays(uid, '2026-27'), {
      initialProps: { uid: 'u1' },
    });
    act(() => {
      callbacks.get('WORK_DAYS_COL:u1')!(fakeSnap([{ id: '2026-07-01', data: { type: 'home' } }]));
    });
    expect(result.current.days).toHaveLength(1);

    rerender({ uid: 'u2' });
    expect(result.current.days).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(callbacks.has('WORK_DAYS_COL:u1')).toBe(false);
    expect(callbacks.has('WORK_DAYS_COL:u2')).toBe(true);
  });

  it('does not subscribe without a uid and reports no days and no loading', () => {
    const { result } = renderHook(() => useWorkDays(undefined, '2026-27'));

    expect(result.current).toEqual({ days: [], loading: false, error: false });
    expect(callbacks.size).toBe(0);
    expect(queryCalls).toHaveLength(0);
  });

  it('unblocks `loading` on a listener error instead of hanging forever', () => {
    const { result } = renderHook(() => useWorkDays('u1', '2026-27'));
    expect(result.current.loading).toBe(true);

    act(() => {
      errorCallbacks.get('WORK_DAYS_COL:u1')!();
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.days).toEqual([]);
  });

  describe('error', () => {
    it('is false while loading and once the days have loaded', () => {
      const { result } = renderHook(() => useWorkDays('u1', '2026-27'));
      expect(result.current.error).toBe(false);

      act(() => {
        callbacks.get('WORK_DAYS_COL:u1')!(fakeSnap([{ id: '2026-07-01', data: { type: 'home' } }]));
      });
      expect(result.current.error).toBe(false);
    });

    // Without it an empty list after a failure reads as a year with no days.
    it('is set when the listener fails before any snapshot', () => {
      const { result } = renderHook(() => useWorkDays('u1', '2026-27'));
      act(() => {
        errorCallbacks.get('WORK_DAYS_COL:u1')!();
      });
      expect(result.current).toEqual({ days: [], loading: false, error: true });
    });

    it('is cleared by a later snapshot', () => {
      const { result } = renderHook(() => useWorkDays('u1', '2026-27'));
      act(() => {
        errorCallbacks.get('WORK_DAYS_COL:u1')!();
      });
      expect(result.current.error).toBe(true);

      act(() => {
        callbacks.get('WORK_DAYS_COL:u1')!(fakeSnap([{ id: '2026-07-01', data: { type: 'home' } }]));
      });
      expect(result.current.error).toBe(false);
      expect(result.current.days).toHaveLength(1);
    });

    it('is cleared when the income year changes, and stays clear on stepping back', () => {
      const { result, rerender } = renderHook(({ year }) => useWorkDays('u1', year), {
        initialProps: { year: '2026-27' },
      });
      act(() => {
        errorCallbacks.get('WORK_DAYS_COL:u1')!();
      });
      expect(result.current.error).toBe(true);

      rerender({ year: '2027-28' });
      expect(result.current.error).toBe(false);
      expect(result.current.loading).toBe(true);

      rerender({ year: '2026-27' });
      expect(result.current.error).toBe(false);
      expect(result.current.loading).toBe(true);
    });

    it('is cleared when the user changes', () => {
      const { result, rerender } = renderHook(({ uid }) => useWorkDays(uid, '2026-27'), {
        initialProps: { uid: 'u1' as string | undefined },
      });
      act(() => {
        errorCallbacks.get('WORK_DAYS_COL:u1')!();
      });
      expect(result.current.error).toBe(true);

      rerender({ uid: undefined });
      expect(result.current.error).toBe(false);
    });
  });

  it('unsubscribes when the component unmounts', () => {
    const { unmount } = renderHook(() => useWorkDays('u1', '2026-27'));
    expect(callbacks.has('WORK_DAYS_COL:u1')).toBe(true);

    unmount();
    expect(callbacks.size).toBe(0);
  });
});
