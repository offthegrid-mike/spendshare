import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveTheme, applyTheme, startThemeSync } from './theme';
import { useUIStore } from '../stores/uiStore';

// These cover dark mode as it behaves once enabled (redesign PR 5).
vi.mock('./features', () => ({ DARK_MODE_ENABLED: true }));

// A controllable prefers-color-scheme: dark media query.
function mockColorScheme(initiallyDark: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches: initiallyDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  vi.spyOn(window, 'matchMedia').mockImplementation(() => mql as unknown as MediaQueryList);
  return {
    setDark(dark: boolean) {
      mql.matches = dark;
      listeners.forEach((fn) => fn());
    },
  };
}

function themeColor() {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
}

beforeEach(() => {
  document.head.innerHTML = '<meta name="theme-color" content="#000000" />';
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  vi.restoreAllMocks();
  useUIStore.setState({ theme: 'system' });
});

describe('resolveTheme', () => {
  it.each([
    ['system', false, 'light'],
    ['system', true, 'dark'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
  ] as const)('%s with prefersDark=%s resolves to %s', (pref, prefersDark, expected) => {
    expect(resolveTheme(pref, prefersDark)).toBe(expected);
  });
});

describe('applyTheme', () => {
  it('sets data-theme for an explicit preference and updates theme-color', () => {
    mockColorScheme(false);
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(themeColor()).toBe('#0a0d0c');

    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(themeColor()).toBe('#f3f6f4');
  });

  it('removes data-theme for system and takes theme-color from the OS scheme', () => {
    mockColorScheme(true);
    document.documentElement.dataset.theme = 'light';
    applyTheme('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(themeColor()).toBe('#0a0d0c');
  });
});

describe('startThemeSync', () => {
  it('applies the stored preference immediately', () => {
    mockColorScheme(false);
    useUIStore.setState({ theme: 'dark' });
    const stop = startThemeSync();
    expect(document.documentElement.dataset.theme).toBe('dark');
    stop();
  });

  it('re-applies when the stored preference changes', () => {
    mockColorScheme(false);
    const stop = startThemeSync();
    useUIStore.getState().setTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    stop();
  });

  it('follows OS scheme changes while the preference is system', () => {
    const scheme = mockColorScheme(false);
    const stop = startThemeSync();
    expect(themeColor()).toBe('#f3f6f4');
    scheme.setDark(true);
    expect(themeColor()).toBe('#0a0d0c');
    stop();
  });

  it('ignores OS scheme changes when the preference is explicit', () => {
    const scheme = mockColorScheme(false);
    useUIStore.setState({ theme: 'light' });
    const stop = startThemeSync();
    scheme.setDark(true);
    expect(themeColor()).toBe('#f3f6f4');
    expect(document.documentElement.dataset.theme).toBe('light');
    stop();
  });
});
