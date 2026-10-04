import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyTheme } from './theme';

// Uses the real feature flag: dark mode stays off until every screen is on
// the new tokens (redesign PR 5).

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

describe('applyTheme while dark mode is not yet enabled', () => {
  it('forces light even when dark is chosen', () => {
    mockOsDark();
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(themeColor()).toBe('#f3f6f4');
  });

  it('forces light when following a dark OS', () => {
    mockOsDark();
    applyTheme('system');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(themeColor()).toBe('#f3f6f4');
  });
});
