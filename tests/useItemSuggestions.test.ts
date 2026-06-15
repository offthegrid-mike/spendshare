import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { SuggestionEntry } from '../src/types/models';

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

// Import AFTER mocks are registered.
import { useItemSuggestions, writeCache } from '../src/hooks/useItemSuggestions';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const suggestions: SuggestionEntry[] = [
  { name: 'Milk', categoryId: 'cat1', category: 'Groceries', count: 5 },
];

const CACHE_KEY = 'suggestions_g1';

describe('useItemSuggestions', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('returns [[], false] synchronously before async load completes', () => {
    getDoc.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useItemSuggestions('g1'));
    expect(result.current[0]).toEqual([]);
    expect(result.current[1]).toBe(false);
  });

  it('fetches from Firestore on cache miss and returns suggestions with loaded=true', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ items: suggestions }) });
    const { result } = renderHook(() => useItemSuggestions('g1'));
    await waitFor(() => expect(result.current[0]).toEqual(suggestions));
    expect(result.current[1]).toBe(true);
    expect(getDoc).toHaveBeenCalledTimes(1);
  });

  it('reads from localStorage without calling Firestore when cache is fresh', async () => {
    writeCache('g1', suggestions);
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ items: [] }) });
    const { result } = renderHook(() => useItemSuggestions('g1'));
    await waitFor(() => expect(result.current[0]).toEqual(suggestions));
    expect(result.current[1]).toBe(true);
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('fetches from Firestore when cache is stale (>24 h)', async () => {
    const stale = { items: [{ name: 'Old', categoryId: 'x', category: 'X', count: 1 }], cachedAt: Date.now() - 25 * 60 * 60 * 1000 };
    localStorage.setItem(CACHE_KEY, JSON.stringify(stale));
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ items: suggestions }) });
    const { result } = renderHook(() => useItemSuggestions('g1'));
    await waitFor(() => expect(result.current[0]).toEqual(suggestions));
    expect(result.current[1]).toBe(true);
    expect(getDoc).toHaveBeenCalledTimes(1);
  });

  it('returns [[], true] and does not throw when Firestore errors', async () => {
    getDoc.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useItemSuggestions('g1'));
    await waitFor(() => expect(result.current[1]).toBe(true));
    expect(result.current[0]).toEqual([]);
  });

  it('returns [[], true] when Firestore doc does not exist yet', async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    const { result } = renderHook(() => useItemSuggestions('g1'));
    await waitFor(() => expect(result.current[1]).toBe(true));
    expect(result.current[0]).toEqual([]);
  });

  it('writeCache stores items and is readable by the hook', async () => {
    writeCache('g1', suggestions);
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ items: [] }) });
    const { result } = renderHook(() => useItemSuggestions('g1'));
    await waitFor(() => expect(result.current[0]).toEqual(suggestions));
    expect(result.current[1]).toBe(true);
    expect(getDoc).not.toHaveBeenCalled();
  });
});
