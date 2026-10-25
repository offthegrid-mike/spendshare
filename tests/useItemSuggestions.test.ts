import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { SuggestionEntry, ShopEntry } from '../src/types/models';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { getDoc } = vi.hoisted(() => ({ getDoc: vi.fn() }));

vi.mock('firebase/firestore', () => ({
  getDoc: (...args: unknown[]) => getDoc(...args),
  getFirestore: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn((_db: unknown, path: string) => ({ path })),
}));

vi.mock('../src/lib/firebase', () => ({ db: { _mock: true } }));
vi.mock('../src/lib/converters', () => ({
  suggestionsDocRef: vi.fn((gid: string) => ({ path: `groups/${gid}/suggestions/index` })),
}));

import { useItemSuggestions, writeCache } from '../src/hooks/useItemSuggestions';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const suggestions: SuggestionEntry[] = [
  { name: 'Milk', categoryId: 'cat1', category: 'Groceries', count: 5 },
];
const shops: ShopEntry[] = [{ name: 'Woolworths', count: 3 }];

const CACHE_KEY = 'suggestions_g1';

describe('useItemSuggestions', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('returns [[], [], false] synchronously before async load completes', () => {
    getDoc.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useItemSuggestions('g1'));
    expect(result.current[0]).toEqual([]);
    expect(result.current[1]).toEqual([]);
    expect(result.current[2]).toBe(false);
  });

  it('fetches from Firestore on cache miss and returns items+shops with loaded=true', async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ items: suggestions, shops }),
    });
    const { result } = renderHook(() => useItemSuggestions('g1'));
    await waitFor(() => expect(result.current[2]).toBe(true));
    expect(result.current[0]).toEqual(suggestions);
    expect(result.current[1]).toEqual(shops);
    expect(getDoc).toHaveBeenCalledTimes(1);
  });

  it('returns empty shops array when Firestore doc has no shops field', async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ items: suggestions }), // no shops field
    });
    const { result } = renderHook(() => useItemSuggestions('g1'));
    await waitFor(() => expect(result.current[2]).toBe(true));
    expect(result.current[1]).toEqual([]);
  });

  it('reads from localStorage without calling Firestore when cache is fresh', async () => {
    writeCache('g1', suggestions, shops);
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ items: [], shops: [] }) });
    const { result } = renderHook(() => useItemSuggestions('g1'));
    await waitFor(() => expect(result.current[2]).toBe(true));
    expect(result.current[0]).toEqual(suggestions);
    expect(result.current[1]).toEqual(shops);
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('fetches from Firestore when cache is stale (>24 h)', async () => {
    const stale = {
      items: [{ name: 'Old', categoryId: 'x', category: 'X', count: 1 }],
      shops: [],
      cachedAt: Date.now() - 25 * 60 * 60 * 1000,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(stale));
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ items: suggestions, shops }) });
    const { result } = renderHook(() => useItemSuggestions('g1'));
    await waitFor(() => expect(result.current[2]).toBe(true));
    expect(result.current[0]).toEqual(suggestions);
    expect(getDoc).toHaveBeenCalledTimes(1);
  });

  it('returns [[], [], true] and does not throw when Firestore errors', async () => {
    getDoc.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useItemSuggestions('g1'));
    await waitFor(() => expect(result.current[2]).toBe(true));
    expect(result.current[0]).toEqual([]);
    expect(result.current[1]).toEqual([]);
  });

  it('returns [[], [], true] when Firestore doc does not exist', async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    const { result } = renderHook(() => useItemSuggestions('g1'));
    await waitFor(() => expect(result.current[2]).toBe(true));
    expect(result.current[0]).toEqual([]);
    expect(result.current[1]).toEqual([]);
  });

  it('writeCache stores items+shops and is readable by the hook', async () => {
    writeCache('g1', suggestions, shops);
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ items: [], shops: [] }) });
    const { result } = renderHook(() => useItemSuggestions('g1'));
    await waitFor(() => expect(result.current[2]).toBe(true));
    expect(result.current[0]).toEqual(suggestions);
    expect(result.current[1]).toEqual(shops);
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('updates a mounted hook when writeCache is called for its group', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ items: suggestions, shops }) });
    const { result } = renderHook(() => useItemSuggestions('g1'));
    await waitFor(() => expect(result.current[2]).toBe(true));

    const items: SuggestionEntry[] = [{ name: 'Bread', categoryId: 'cat1', category: 'Groceries', count: 1 }];
    const nextShops: ShopEntry[] = [{ name: 'Coles', count: 1 }];
    act(() => writeCache('g1', items, nextShops));

    expect(result.current[0]).toEqual(items);
    expect(result.current[1]).toEqual(nextShops);
  });

  it("ignores writeCache for another group", async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ items: suggestions, shops }) });
    const { result } = renderHook(() => useItemSuggestions('g1'));
    await waitFor(() => expect(result.current[2]).toBe(true));

    act(() => writeCache('g2', [], []));

    expect(result.current[0]).toEqual(suggestions);
    expect(result.current[1]).toEqual(shops);
  });
});
