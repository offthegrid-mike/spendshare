import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, screen } from '@testing-library/react';
import { WorkProvider, useWork } from './WorkContext';
import { DEFAULT_WORK_SETTINGS } from '../../lib/work/workSettings';

const clock = { today: '2026-10-19', nowMinutes: 540 };
const hooks = vi.hoisted(() => ({
  settings: { settings: null as unknown, loading: false, loaded: false },
}));

vi.mock('../../hooks/useWorkSettings', () => ({ useWorkSettings: () => hooks.settings }));
vi.mock('../../hooks/useWorkClock', () => ({ useWorkClock: () => clock }));

function Reader() {
  const work = useWork();
  return (
    <output data-testid="work">
      {JSON.stringify({ ...work })}
    </output>
  );
}

describe('WorkProvider', () => {
  it('hands its children the uid, the settings, both settings flags and the clock', () => {
    hooks.settings = {
      settings: { ...DEFAULT_WORK_SETTINGS, defaultMinutes: 450 },
      loading: true,
      loaded: false,
    };
    render(
      <WorkProvider uid="mike">
        <Reader />
      </WorkProvider>,
    );

    expect(JSON.parse(screen.getByTestId('work').textContent ?? '')).toEqual({
      uid: 'mike',
      settings: { ...DEFAULT_WORK_SETTINGS, defaultMinutes: 450 },
      settingsLoading: true,
      settingsLoaded: false,
      clock,
    });
  });

  it('reports a loaded snapshot as loaded and no longer loading', () => {
    hooks.settings = { settings: DEFAULT_WORK_SETTINGS, loading: false, loaded: true };
    const { result } = renderHook(() => useWork(), {
      wrapper: ({ children }) => <WorkProvider uid="mike">{children}</WorkProvider>,
    });

    expect(result.current.settingsLoading).toBe(false);
    expect(result.current.settingsLoaded).toBe(true);
  });

  it('keeps the same value between renders while nothing changed', () => {
    hooks.settings = { settings: DEFAULT_WORK_SETTINGS, loading: false, loaded: true };
    const { result, rerender } = renderHook(() => useWork(), {
      wrapper: ({ children }) => <WorkProvider uid="mike">{children}</WorkProvider>,
    });
    const first = result.current;

    rerender();
    expect(result.current).toBe(first);
  });
});

describe('useWork', () => {
  it('throws when used outside a WorkProvider', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useWork())).toThrow(/WorkProvider/);
    error.mockRestore();
  });
});
