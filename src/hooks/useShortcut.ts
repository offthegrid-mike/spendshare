import { useEffect, useEffectEvent } from 'react';
import { ignoreShortcut, type ShortcutOptions } from '../lib/shortcuts';

interface Options extends ShortcutOptions {
  /** Listens only while true. */
  enabled?: boolean;
}

/**
 * Calls `handler` when one of `keys` is pressed anywhere on the page (letters
 * match either case), unless `ignoreShortcut` says to leave the key alone. The
 * key is claimed with preventDefault; a handler that returns false declines it,
 * leaving it to others.
 */
export function useShortcut(
  keys: string[],
  handler: (event: KeyboardEvent) => boolean | void,
  { enabled = true, mod = false, whileTyping = false }: Options = {},
): void {
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (!keys.some((k) => k.toLowerCase() === key) || ignoreShortcut(event, { mod, whileTyping })) return;
    if (handler(event) !== false) event.preventDefault();
  });

  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [enabled]);
}
