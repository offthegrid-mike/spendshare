import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRefunds } from './useRefunds';

const { getDocs, wheres } = vi.hoisted(() => ({ getDocs: vi.fn(), wheres: [] as unknown[][] }));

vi.mock('../lib/converters', () => ({ expensesCol: (gid: string) => `groups/${gid}/expenses` }));
vi.mock('firebase/firestore', () => ({
  query: (base: string) => base,
  where: (...args: unknown[]) => { wheres.push(args); return {}; },
  getDocs: (q: string) => getDocs(q),
}));

const snap = (docs: Array<Record<string, unknown>>) => ({ docs: docs.map((d) => ({ id: d.id, data: () => d })) });

beforeEach(() => {
  getDocs.mockReset();
  wheres.length = 0;
});

describe('useRefunds', () => {
  it('loads the refunds made from an expense', async () => {
    getDocs.mockResolvedValue(snap([{ id: 'r1', total: 500, kind: 'refund', refundOf: 'e1' }]));
    const { result } = renderHook(() => useRefunds('g1', 'e1'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(wheres).toEqual([['refundOf', '==', 'e1']]);
    expect(result.current.refunds.map((r) => r.id)).toEqual(['r1']);
  });

  it('loads nothing without an expense', () => {
    const { result } = renderHook(() => useRefunds('g1', undefined));
    expect(result.current).toEqual({ refunds: [], loading: false, error: false });
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('reports a failed load', async () => {
    getDocs.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useRefunds('g1', 'e1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
  });
});
