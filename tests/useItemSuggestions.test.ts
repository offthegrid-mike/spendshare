import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { SuggestionEntry, ShopEntry } from '../src/types/models';

// ---------------------------------------------------------------------------
// Hoisted mocks: onSnapshot hands each listener to the test, which then plays
// the snapshots Firestore would send.
// ---------------------------------------------------------------------------
type Snapshot = { exists: () => boolean; data: () => unknown; metadata: { fromCache: boolean } };
type Listener = { path: string; next: (snap: Snapshot) => void; error: (err: Error) => void; unsubscribe: () => void };

const { listeners, onSnapshot } = vi.hoisted(() => {
  const listeners: Listener[] = [];
  const onSnapshot = vi.fn(
    (ref: { path: string }, _opts: unknown, next: Listener['next'], error: Listener['error']) => {
      const listener = { path: ref.path, next, error, unsubscribe: vi.fn() };
      listeners.push(listener);
      return listener.unsubscribe;
    },
  );
  return { listeners, onSnapshot };
});

vi.mock('firebase/firestore', () => ({ onSnapshot }));
vi.mock('../src/lib/converters', () => ({
  suggestionsDocRef: vi.fn((gid: string) => ({ path: `groups/${gid}/suggestions/index` })),
}));

import { useItemSuggestions } from '../src/hooks/useItemSuggestions';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const suggestions: SuggestionEntry[] = [
  { name: 'Milk', categoryId: 'cat1', category: 'Groceries', count: 5 },
];
const shops: ShopEntry[] = [{ name: 'Woolworths', count: 3 }];

function snap(doc: { items?: SuggestionEntry[]; shops?: ShopEntry[] } | null, fromCache = false): Snapshot {
  return { exists: () => doc !== null, data: () => doc, metadata: { fromCache } };
}

const latest = () => listeners[listeners.length - 1];

describe('useItemSuggestions', () => {
  beforeEach(() => {
    listeners.length = 0;
    vi.clearAllMocks();
  });

  it('listens to the group suggestions, including metadata changes', () => {
    renderHook(() => useItemSuggestions('g1'));
    expect(latest().path).toBe('groups/g1/suggestions/index');
    expect(onSnapshot.mock.calls[0][1]).toEqual({ includeMetadataChanges: true });
  });

  it('returns [[], [], false] before the first snapshot', () => {
    const { result } = renderHook(() => useItemSuggestions('g1'));
    expect(result.current).toEqual([[], [], false]);
  });

  it('loads items and shops from a server snapshot', () => {
    const { result } = renderHook(() => useItemSuggestions('g1'));
    act(() => latest().next(snap({ items: suggestions, shops })));
    expect(result.current).toEqual([suggestions, shops, true]);
  });

  it('treats a missing doc confirmed by the server as empty and loaded', () => {
    const { result } = renderHook(() => useItemSuggestions('g1'));
    act(() => latest().next(snap(null)));
    expect(result.current).toEqual([[], [], true]);
  });

  it('defaults a missing shops field to an empty list', () => {
    const { result } = renderHook(() => useItemSuggestions('g1'));
    act(() => latest().next(snap({ items: suggestions })));
    expect(result.current).toEqual([suggestions, [], true]);
  });

  it('does not trust a cached "no doc" snapshot until the server confirms it', () => {
    const { result } = renderHook(() => useItemSuggestions('g1'));
    act(() => latest().next(snap(null, true)));
    expect(result.current[2]).toBe(false);

    act(() => latest().next(snap({ items: suggestions, shops })));
    expect(result.current).toEqual([suggestions, shops, true]);
  });

  it('uses a cached copy of the doc, so it works offline', () => {
    const { result } = renderHook(() => useItemSuggestions('g1'));
    act(() => latest().next(snap({ items: suggestions, shops }, true)));
    expect(result.current).toEqual([suggestions, shops, true]);
  });

  it('follows later snapshots, such as another member saving', () => {
    const { result } = renderHook(() => useItemSuggestions('g1'));
    act(() => latest().next(snap({ items: suggestions, shops })));

    const updated: SuggestionEntry[] = [{ ...suggestions[0], count: 6 }];
    act(() => latest().next(snap({ items: updated, shops })));

    expect(result.current).toEqual([updated, shops, true]);
  });

  it('stays not loaded on a listener error, so saves never write from an empty list', () => {
    const { result } = renderHook(() => useItemSuggestions('g1'));
    act(() => latest().error(new Error('permission-denied')));
    expect(result.current).toEqual([[], [], false]);
  });

  it("re-subscribes on a group switch and never shows the old group's lists as loaded", () => {
    const { result, rerender } = renderHook(({ gid }) => useItemSuggestions(gid), { initialProps: { gid: 'g1' } });
    const first = latest();
    act(() => first.next(snap({ items: suggestions, shops })));

    rerender({ gid: 'g2' });

    expect(first.unsubscribe).toHaveBeenCalled();
    expect(latest().path).toBe('groups/g2/suggestions/index');
    expect(result.current).toEqual([[], [], false]);
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useItemSuggestions('g1'));
    const listener = latest();
    unmount();
    expect(listener.unsubscribe).toHaveBeenCalled();
  });
});
