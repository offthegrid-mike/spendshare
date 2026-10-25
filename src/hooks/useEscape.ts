import { useEffect, useEffectEvent } from 'react';

/**
 * Calls `onClose` when Esc is pressed while `open`, for dialogs. A control that
 * already handled Esc (an open popover, say) keeps it, so one press closes one thing.
 */
export function useEscape(open: boolean, onClose: () => void): void {
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    onClose();
  });

  useEffect(() => {
    if (!open) return;
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [open]);
}
