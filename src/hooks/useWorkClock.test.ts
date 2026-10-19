import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkClock } from './useWorkClock';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 19, 9)); // Monday 19 October 2026, 09:00
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useWorkClock', () => {
  it('starts at the local date and the minutes since midnight', () => {
    const { result } = renderHook(() => useWorkClock());
    expect(result.current).toEqual({ today: '2026-10-19', nowMinutes: 540 });
  });

  it('moves on by a minute every 60 seconds', () => {
    const { result } = renderHook(() => useWorkClock());

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toEqual({ today: '2026-10-19', nowMinutes: 541 });

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.nowMinutes).toBe(542);
  });

  it('rolls today over past midnight', () => {
    vi.setSystemTime(new Date(2026, 9, 19, 23, 59));
    const { result } = renderHook(() => useWorkClock());
    expect(result.current).toEqual({ today: '2026-10-19', nowMinutes: 1439 });

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toEqual({ today: '2026-10-20', nowMinutes: 0 });
  });

  it('keeps the same object while the minute has not changed', () => {
    const { result } = renderHook(() => useWorkClock());
    const first = result.current;

    // Ten seconds later, e.g. a tab coming back to the front: still 09:00.
    act(() => {
      vi.setSystemTime(new Date(2026, 9, 19, 9, 0, 10));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe(first);
  });

  it('catches up when the tab becomes visible again', () => {
    const { result } = renderHook(() => useWorkClock());

    // A backgrounded tab's timer is throttled or paused, so time jumps ahead
    // without the interval ever firing.
    act(() => {
      vi.setSystemTime(new Date(2026, 9, 20, 7, 30));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toEqual({ today: '2026-10-20', nowMinutes: 450 });
  });

  it('stops ticking and listening when it unmounts', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useWorkClock());
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    remove.mockRestore();
  });
});
