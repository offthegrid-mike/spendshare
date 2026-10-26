import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { chartColorsFrom, useChartColors } from './useChartColors';

const LIGHT: Record<string, string> = {
  '--accent': '4 120 87', '--ink': '16 22 20', '--line': '224 230 226',
  '--recessed': '232 238 234', '--ink-muted': '91 102 96', '--surface': '252 253 252',
  '--series-1': '42 120 214', '--series-2': '235 104 52', '--series-3': '27 175 122',
  '--series-4': '237 161 0', '--series-5': '232 123 164',
};
const DARK: Record<string, string> = {
  '--accent': '47 208 140', '--ink': '236 242 239', '--line': '35 43 40',
  '--recessed': '30 37 34', '--ink-muted': '148 160 154', '--surface': '20 25 23',
  '--series-1': '57 135 229', '--series-2': '217 89 38', '--series-3': '25 158 112',
  '--series-4': '201 133 0', '--series-5': '213 81 129',
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

  it('reads the five series colours, in order', () => {
    const c = chartColorsFrom((name) => LIGHT[name] ?? '');
    expect([c.series1, c.series2, c.series3, c.series4, c.series5]).toEqual([
      'rgb(42 120 214)', 'rgb(235 104 52)', 'rgb(27 175 122)', 'rgb(237 161 0)', 'rgb(232 123 164)',
    ]);
  });

  it('falls back to the light palette when a token is missing', () => {
    const c = chartColorsFrom(() => '');
    expect(c.spending).toBe('#047857');
    expect(c.income).toBe('#101614');
    expect(c.grid).toBe('#e0e6e2');
    expect(c.series1).toBe('#2a78d6');
    expect(c.series5).toBe('#e87ba4');
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
