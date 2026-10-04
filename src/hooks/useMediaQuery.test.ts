import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery, useIsDesktop } from './useMediaQuery';

function mockQuery(initial: boolean) {
  const listeners = new Set<() => void>();
  const queries: string[] = [];
  const mql = {
    matches: initial,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => {
    queries.push(q);
    return mql as unknown as MediaQueryList;
  });
  return {
    queries,
    set(matches: boolean) {
      mql.matches = matches;
      listeners.forEach((fn) => fn());
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe('useMediaQuery', () => {
  it('returns whether the query currently matches', () => {
    mockQuery(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 500px)'));
    expect(result.current).toBe(true);
  });

  it('updates when the query starts or stops matching', () => {
    const q = mockQuery(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 500px)'));
    expect(result.current).toBe(false);
    act(() => q.set(true));
    expect(result.current).toBe(true);
  });
});

describe('useIsDesktop', () => {
  it('queries the 1024px breakpoint', () => {
    const q = mockQuery(true);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);
    expect(q.queries).toContain('(min-width: 1024px)');
  });
});
