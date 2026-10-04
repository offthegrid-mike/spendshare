import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('scroll', onChange, { passive: true });
  return () => window.removeEventListener('scroll', onChange);
}

/** Whether the page has scrolled away from the top. */
export function useScrolled(): boolean {
  return useSyncExternalStore(subscribe, () => window.scrollY > 0, () => false);
}
