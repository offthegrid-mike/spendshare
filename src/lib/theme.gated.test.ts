import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyTheme } from './theme';

// Uses the real feature flag, which enables the final redesign's theme controls.

function mockOsDark() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList,
  );
}

function themeColor() {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content');
}

beforeEach(() => {
  document.head.innerHTML = '<meta name="theme-color" content="#000000" />';
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => vi.restoreAllMocks());

describe('applyTheme with dark mode enabled', () => {
  it('uses dark when dark is chosen', () => {
    mockOsDark();
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(themeColor()).toBe('#0a0d0c');
  });

  it('follows a dark OS for the system preference', () => {
    mockOsDark();
    applyTheme('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(themeColor()).toBe('#0a0d0c');
  });
});
