import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { chartColorsFrom, useChartColors } from './useChartColors';

const LIGHT: Record<string, string> = {
  '--accent': '4 120 87', '--ink': '16 22 20', '--line': '224 230 226',
  '--recessed': '232 238 234', '--ink-muted': '91 102 96', '--surface': '252 253 252',
};
const DARK: Record<string, string> = {
  '--accent': '47 208 140', '--ink': '236 242 239', '--line': '35 43 40',
  '--recessed': '30 37 34', '--ink-muted': '148 160 154', '--surface': '20 25 23',
};

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-theme');
});

describe('chartColorsFrom', () => {
  it('turns token triplets into rgb() colours', () => {
    const c = chartColorsFrom((name) => LIGHT[name] ?? '');
    expect(c.spending).toBe('rgb(4 120 87)');
    expect(c.income).toBe('rgb(16 22 20)');
    expect(c.grid).toBe('rgb(224 230 226)');
    expect(c.cursor).toBe('rgb(232 238 234)');
    expect(c.label).toBe('rgb(91 102 96)');
    expect(c.surface).toBe('rgb(252 253 252)');
  });

  it('falls back to the light palette when a token is missing', () => {
    const c = chartColorsFrom(() => '');
    expect(c.spending).toBe('#047857');
    expect(c.income).toBe('#101614');
    expect(c.grid).toBe('#e0e6e2');
  });
});

describe('useChartColors', () => {
  it('re-reads the tokens when the theme attribute changes', async () => {
    let palette = LIGHT;
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      () => ({ getPropertyValue: (n: string) => palette[n] ?? '' }) as unknown as CSSStyleDeclaration,
    );
    const { result } = renderHook(() => useChartColors());
    expect(result.current.spending).toBe('rgb(4 120 87)');

    palette = DARK;
    await act(async () => {
      document.documentElement.dataset.theme = 'dark';
      await Promise.resolve(); // MutationObserver callbacks run as microtasks
    });
    expect(result.current.spending).toBe('rgb(47 208 140)');
  });
});
