import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { useAllowlist } from './useAllowlist';

const { callbacks, errorCallbacks } = vi.hoisted(() => ({
  callbacks: new Map<string, (snap: unknown) => void>(),
  errorCallbacks: new Map<string, () => void>(),
}));

vi.mock('../lib/firebase', () => ({ db: 'DB' }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: string, col: string, id: string) => `${col}/${id}`,
  onSnapshot: (ref: string, cb: (snap: unknown) => void, onError?: () => void) => {
    callbacks.set(ref, cb);
    if (onError) errorCallbacks.set(ref, onError);
    return () => callbacks.delete(ref);
  },
}));

function user(email: string | null, emailVerified = true) {
  return { uid: 'u1', email, emailVerified } as unknown as User;
}

const snap = (exists: boolean) => ({ exists: () => exists });

describe('useAllowlist', () => {
  beforeEach(() => {
    callbacks.clear();
    errorCallbacks.clear();
  });

  it('is loading until the allowlist entry arrives, then allowed when it exists', () => {
    const { result } = renderHook(() => useAllowlist(user('Me@Example.com')));
    expect(result.current).toBe('loading');

    act(() => callbacks.get('allowlist/me@example.com')!(snap(true)));
    expect(result.current).toBe('allowed');
  });

  it('is denied when there is no allowlist entry for the email', () => {
    const { result } = renderHook(() => useAllowlist(user('stranger@example.com')));
    act(() => callbacks.get('allowlist/stranger@example.com')!(snap(false)));
    expect(result.current).toBe('denied');
  });

  it('is denied when the allowlist read fails', () => {
    const { result } = renderHook(() => useAllowlist(user('me@example.com')));
    act(() => errorCallbacks.get('allowlist/me@example.com')!());
    expect(result.current).toBe('denied');
  });

  it('is unverified, without reading the allowlist, when the email is not verified', () => {
    const { result } = renderHook(() => useAllowlist(user('me@example.com', false)));
    expect(result.current).toBe('unverified');
    expect(callbacks.size).toBe(0);
  });

  it('is denied for an account with no email', () => {
    const { result } = renderHook(() => useAllowlist(user(null)));
    expect(result.current).toBe('denied');
    expect(callbacks.size).toBe(0);
  });

  it('is signed-out with no user', () => {
    const { result } = renderHook(() => useAllowlist(null));
    expect(result.current).toBe('signed-out');
  });

  it("does not carry one email's result over to the next", () => {
    let current = user('me@example.com');
    const { result, rerender } = renderHook(() => useAllowlist(current));
    act(() => callbacks.get('allowlist/me@example.com')!(snap(true)));
    expect(result.current).toBe('allowed');

    current = user('other@example.com');
    rerender();
    expect(result.current).toBe('loading');
  });
});
