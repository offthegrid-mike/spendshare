import { useSyncExternalStore } from 'react';

export interface VisualViewportRect {
  offsetTop: number;
  height: number;
}

let cached: VisualViewportRect | null = null;

function subscribe(onChange: () => void) {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  vv.addEventListener('resize', onChange);
  vv.addEventListener('scroll', onChange);
  return () => {
    vv.removeEventListener('resize', onChange);
    vv.removeEventListener('scroll', onChange);
  };
}

function getSnapshot(): VisualViewportRect | null {
  const vv = window.visualViewport;
  if (!vv) return null;
  if (!cached || cached.offsetTop !== vv.offsetTop || cached.height !== vv.height) {
    cached = { offsetTop: vv.offsetTop, height: vv.height };
  }
  return cached;
}

/**
 * The part of the page actually visible on screen. On mobile the on-screen
 * keyboard shrinks this (not the layout viewport), so overlays sized with
 * `inset-0` or `dvh` end up partly hidden behind it.
 */
export function useVisualViewport(): VisualViewportRect | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
