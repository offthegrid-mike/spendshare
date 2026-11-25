import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const listeners: { q: unknown; next: (snap: unknown) => void; error: () => void }[] = [];
vi.mock('firebase/firestore', () => ({
  onSnapshot: (q: unknown, next: (snap: unknown) => void, error: () => void) => {
    listeners.push({ q, next, error });
    return () => {};
  },
}));
vi.mock('../lib/converters', () => ({
  walletsCol: (gid: string) => ({ path: `groups/${gid}/wallets` }),
  topUpsCol: (gid: string) => ({ path: `groups/${gid}/topUps` }),
}));

import { useTripWallets } from './useTripWallets';

const snap = (docs: Record<string, unknown>[]) => ({ docs: docs.map((d) => ({ id: d.id, data: () => d })) });

beforeEach(() => { listeners.length = 0; });

describe('useTripWallets', () => {
  it('loads the trip’s wallets and top-ups', () => {
    const { result } = renderHook(() => useTripWallets('japan'));
    expect(result.current.loading).toBe(true);
    expect(listeners.map((l) => l.q)).toEqual([{ path: 'groups/japan/wallets' }, { path: 'groups/japan/topUps' }]);
    act(() => listeners[0].next(snap([{ id: 'alex_JPY' }])));
    expect(result.current.loading).toBe(true);
    act(() => listeners[1].next(snap([{ id: 't1', walletId: 'alex_JPY' }])));
    expect(result.current.loading).toBe(false);
    expect(result.current.wallets.map((w) => w.id)).toEqual(['alex_JPY']);
    expect(result.current.topUps.map((t) => t.id)).toEqual(['t1']);
  });

  it('stops loading on an error', () => {
    const { result } = renderHook(() => useTripWallets('japan'));
    act(() => { listeners[0].error(); listeners[1].error(); });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(true);
  });

  it('loads nothing without a trip', () => {
    const { result } = renderHook(() => useTripWallets(null));
    expect(listeners).toHaveLength(0);
    expect(result.current.loading).toBe(false);
  });
});
