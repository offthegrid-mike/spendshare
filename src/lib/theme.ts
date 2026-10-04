import { useUIStore } from '../stores/uiStore';
import { DARK_MODE_ENABLED } from './features';

export type ThemePref = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

// The canvas colour per theme, for the browser/PWA chrome (<meta name="theme-color">).
const CANVAS: Record<ResolvedTheme, string> = { light: '#f3f6f4', dark: '#0a0d0c' };

const DARK_QUERY = '(prefers-color-scheme: dark)';

function prefersDark(): boolean {
  return window.matchMedia?.(DARK_QUERY).matches ?? false;
}

export function resolveTheme(pref: ThemePref, prefersDarkScheme: boolean): ResolvedTheme {
  if (pref === 'system') return prefersDarkScheme ? 'dark' : 'light';
  return pref;
}

/**
 * Points the CSS tokens at the preferred theme. With `system`, data-theme is
 * removed so the prefers-color-scheme media query in index.css decides.
 */
export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  if (!DARK_MODE_ENABLED) {
    // Pin light so the prefers-color-scheme rules in index.css never apply.
    root.dataset.theme = 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CANVAS.light);
    return;
  }
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = pref;

  const color = CANVAS[resolveTheme(pref, prefersDark())];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}

/**
 * Applies the stored preference now and keeps it applied as the preference or
 * the OS scheme changes. Call before the first render so there is no flash
 * (the store hydrates from localStorage synchronously).
 */
export function startThemeSync(): () => void {
  applyTheme(useUIStore.getState().theme);

  const unsubscribe = useUIStore.subscribe((state, prev) => {
    if (state.theme !== prev.theme) applyTheme(state.theme);
  });

  const mql = window.matchMedia?.(DARK_QUERY);
  const onSchemeChange = () => {
    const { theme } = useUIStore.getState();
    if (theme === 'system') applyTheme(theme);
  };
  mql?.addEventListener('change', onSchemeChange);

  return () => {
    unsubscribe();
    mql?.removeEventListener('change', onSchemeChange);
  };
}
