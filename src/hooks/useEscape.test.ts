import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEscape } from './useEscape';

function pressEscape(alreadyHandled = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  if (alreadyHandled) event.preventDefault();
  window.dispatchEvent(event);
  return event;
}

describe('useEscape', () => {
  it('calls onClose and claims the key while open', () => {
    const onClose = vi.fn();
    renderHook(() => useEscape(true, onClose));
    const event = pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves Esc to a control that already handled it, such as an open popover', () => {
    const onClose = vi.fn();
    renderHook(() => useEscape(true, onClose));
    pressEscape(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does nothing while closed', () => {
    const onClose = vi.fn();
    renderHook(() => useEscape(false, onClose));
    pressEscape();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores other keys', () => {
    const onClose = vi.fn();
    renderHook(() => useEscape(true, onClose));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
