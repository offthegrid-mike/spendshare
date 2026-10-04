import { useCallback, useSyncExternalStore } from 'react';

/** Whether a CSS media query currently matches; re-renders when that changes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

/** The desktop shell breakpoint (Tailwind `lg`). */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}
