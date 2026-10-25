import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useShortcut } from './useShortcut';

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = window): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useShortcut', () => {
  it('calls the handler for its keys and claims the event', () => {
    const handler = vi.fn();
    renderHook(() => useShortcut(['n', 'N'], handler));

    const event = press('N');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('matches letters whatever their case', () => {
    const handler = vi.fn();
    renderHook(() => useShortcut(['n'], handler));
    press('n');
    press('N', { shiftKey: true });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('leaves other keys alone', () => {
    const handler = vi.fn();
    renderHook(() => useShortcut(['n'], handler));
    const event = press('m');
    expect(handler).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('does nothing while disabled', () => {
    const handler = vi.fn();
    renderHook(() => useShortcut(['n'], handler, { enabled: false }));
    press('n');
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores keys typed into a field', () => {
    const handler = vi.fn();
    renderHook(() => useShortcut(['n'], handler));
    const input = document.createElement('input');
    document.body.appendChild(input);
    press('n', {}, input);
    expect(handler).not.toHaveBeenCalled();
  });

  it('fires a mod shortcut while typing when asked', () => {
    const handler = vi.fn();
    renderHook(() => useShortcut(['k', 'K'], handler, { mod: true, whileTyping: true }));
    const input = document.createElement('input');
    document.body.appendChild(input);
    press('k', { metaKey: true }, input);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('lets the handler decline a key, leaving it for others', () => {
    renderHook(() => useShortcut(['ArrowRight'], () => false));
    const event = press('ArrowRight');
    expect(event.defaultPrevented).toBe(false);
  });

  it('uses the latest handler without re-adding the listener', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ handler }) => useShortcut(['n'], handler), { initialProps: { handler: first } });
    rerender({ handler: second });
    press('n');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops listening on unmount', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useShortcut(['n'], handler));
    unmount();
    press('n');
    expect(handler).not.toHaveBeenCalled();
  });
});
