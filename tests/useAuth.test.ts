import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { User } from 'firebase/auth';

// Capture the callback passed to onAuthStateChanged so we can drive it.
let authCallback: ((user: User | null) => void) | null = null;
const unsubscribe = vi.fn();

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(
    (_auth: unknown, cb: (user: User | null) => void) => {
      authCallback = cb;
      return unsubscribe;
    },
  ),
}));

// Avoid running the real firebase init (needs IndexedDB, absent in jsdom).
vi.mock('../src/lib/firebase', () => ({
  auth: {},
  db: {},
  googleProvider: {},
}));

// Stub out Firestore so converters.ts and the upsert in useAuth don't blow up.
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => true })),
  setDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
}));

import { useAuth } from '../src/hooks/useAuth';

describe('useAuth', () => {
  beforeEach(() => {
    authCallback = null;
    unsubscribe.mockClear();
  });

  it('starts loading with no user', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('resolves with the emitted user after the auth callback fires', () => {
    const { result } = renderHook(() => useAuth());
    const fakeUser = { uid: 'abc123', email: 'user@example.com' } as User;

    act(() => {
      authCallback?.(fakeUser);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.user).toEqual(fakeUser);
  });

  it('reports a null user when signed out', () => {
    const { result } = renderHook(() => useAuth());

    act(() => {
      authCallback?.(null);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.user).toBeNull();
  });
});
