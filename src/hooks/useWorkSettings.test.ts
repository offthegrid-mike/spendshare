import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkSettings } from './useWorkSettings';
import { DEFAULT_WORK_SETTINGS } from '../lib/work/workSettings';

const { callbacks, errorCallbacks } = vi.hoisted(() => ({
  callbacks: new Map<string, (snap: unknown) => void>(),
  errorCallbacks: new Map<string, () => void>(),
}));

vi.mock('../lib/converters', () => ({ workSettingsRef: (uid: string) => `SETTINGS_REF:${uid}` }));
vi.mock('firebase/firestore', () => ({
  onSnapshot: (ref: string, cb: (snap: unknown) => void, onError?: () => void) => {
    callbacks.set(ref, cb);
    if (onError) errorCallbacks.set(ref, onError);
    return () => callbacks.delete(ref);
  },
}));

function existingSnap(data: Record<string, unknown>) {
  return { exists: () => true, data: () => data };
}

function missingSnap() {
  return { exists: () => false, data: () => undefined };
}

describe('useWorkSettings', () => {
  beforeEach(() => {
    callbacks.clear();
    errorCallbacks.clear();
  });

  it('is loading, with the defaults, until the first snapshot arrives', () => {
    const { result } = renderHook(() => useWorkSettings('u1'));
    expect(result.current.loading).toBe(true);
    expect(result.current.settings).toEqual(DEFAULT_WORK_SETTINGS);

    act(() => {
      callbacks.get('SETTINGS_REF:u1')!(missingSnap());
    });
    expect(result.current.loading).toBe(false);
  });

  it('gives the defaults when the settings document does not exist', () => {
    const { result } = renderHook(() => useWorkSettings('u1'));

    act(() => {
      callbacks.get('SETTINGS_REF:u1')!(missingSnap());
    });
    expect(result.current.settings).toEqual(DEFAULT_WORK_SETTINGS);
  });

  it('merges a partial document with the defaults', () => {
    const { result } = renderHook(() => useWorkSettings('u1'));

    act(() => {
      callbacks.get('SETTINGS_REF:u1')!(
        existingSnap({ defaultMinutes: 450, trackingStartDate: '2026-07-01' }),
      );
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.settings).toEqual({
      ...DEFAULT_WORK_SETTINGS,
      defaultMinutes: 450,
      trackingStartDate: '2026-07-01',
    });
  });

  it('uses every field of a complete document', () => {
    const { result } = renderHook(() => useWorkSettings('u1'));
    const full = {
      workWeekdays: [1, 3, 5],
      defaultMinutes: 360,
      ratesCentsPerHour: { '2026-27': 1850 },
      trackingStartDate: '2026-08-10',
    };

    act(() => {
      callbacks.get('SETTINGS_REF:u1')!(existingSnap(full));
    });
    expect(result.current.settings).toEqual(full);
  });

  it('keeps the same settings object between renders until a new snapshot arrives', () => {
    const { result, rerender } = renderHook(() => useWorkSettings('u1'));
    act(() => {
      callbacks.get('SETTINGS_REF:u1')!(existingSnap({ defaultMinutes: 450 }));
    });
    const first = result.current.settings;

    rerender();
    expect(result.current.settings).toBe(first);

    act(() => {
      callbacks.get('SETTINGS_REF:u1')!(existingSnap({ defaultMinutes: 480 }));
    });
    expect(result.current.settings).not.toBe(first);
    expect(result.current.settings.defaultMinutes).toBe(480);
  });

  it('keeps the same settings object between renders while the document is missing', () => {
    const { result, rerender } = renderHook(() => useWorkSettings('u1'));
    act(() => {
      callbacks.get('SETTINGS_REF:u1')!(missingSnap());
    });
    const first = result.current.settings;

    rerender();
    expect(result.current.settings).toBe(first);
  });

  it('gives the defaults and no loading without a uid, and does not subscribe', () => {
    const { result } = renderHook(() => useWorkSettings(undefined));

    expect(result.current.loading).toBe(false);
    expect(result.current.settings).toEqual(DEFAULT_WORK_SETTINGS);
    expect(callbacks.size).toBe(0);
  });

  it('drops the previous user\'s settings and loads again when the user changes', () => {
    const { result, rerender } = renderHook(({ uid }) => useWorkSettings(uid), {
      initialProps: { uid: 'u1' },
    });
    act(() => {
      callbacks.get('SETTINGS_REF:u1')!(existingSnap({ defaultMinutes: 450 }));
    });
    expect(result.current.settings.defaultMinutes).toBe(450);

    rerender({ uid: 'u2' });
    expect(result.current.loading).toBe(true);
    expect(result.current.settings).toEqual(DEFAULT_WORK_SETTINGS);
    expect(callbacks.has('SETTINGS_REF:u1')).toBe(false);
    expect(callbacks.has('SETTINGS_REF:u2')).toBe(true);
  });

  it('is loading again, with the defaults, when the user steps from A to B and back to A before B arrives', () => {
    const { result, rerender } = renderHook(({ uid }) => useWorkSettings(uid), {
      initialProps: { uid: 'u1' },
    });
    act(() => {
      callbacks.get('SETTINGS_REF:u1')!(existingSnap({ defaultMinutes: 450 }));
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.settings.defaultMinutes).toBe(450);

    // B never delivers a snapshot before the screen goes back to A.
    rerender({ uid: 'u2' });
    rerender({ uid: 'u1' });
    expect(result.current.loading).toBe(true);
    expect(result.current.settings).toEqual(DEFAULT_WORK_SETTINGS);

    // A's new listener then loads as normal.
    act(() => {
      callbacks.get('SETTINGS_REF:u1')!(existingSnap({ defaultMinutes: 420 }));
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.settings.defaultMinutes).toBe(420);
  });

  it('unblocks `loading` on a listener error instead of hanging forever', () => {
    const { result } = renderHook(() => useWorkSettings('u1'));
    expect(result.current.loading).toBe(true);

    act(() => {
      errorCallbacks.get('SETTINGS_REF:u1')!();
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.settings).toEqual(DEFAULT_WORK_SETTINGS);
  });

  it('unsubscribes when the component unmounts', () => {
    const { unmount } = renderHook(() => useWorkSettings('u1'));
    expect(callbacks.has('SETTINGS_REF:u1')).toBe(true);

    unmount();
    expect(callbacks.size).toBe(0);
  });
});
