import { useMemo, useSyncExternalStore } from 'react';

export interface ChartColors {
  spending: string;
  income: string;
  grid: string;
  cursor: string;
  label: string;
  tick: string;
  surface: string;
  /** Categorical colours, in the order a chart hands them out: one per line, never cycled. */
  series1: string;
  series2: string;
  series3: string;
  series4: string;
  series5: string;
}

// Each chart role and the colour token (src/index.css) it takes.
const TOKENS: Record<keyof ChartColors, string> = {
  spending: '--accent',
  income: '--ink',
  grid: '--line',
  cursor: '--recessed',
  label: '--ink-muted',
  tick: '--ink-muted',
  surface: '--surface',
  series1: '--series-1',
  series2: '--series-2',
  series3: '--series-3',
  series4: '--series-4',
  series5: '--series-5',
};

// Light values, for when custom properties can't be read.
const FALLBACK: ChartColors = {
  spending: '#047857',
  income: '#101614',
  grid: '#e0e6e2',
  cursor: '#e8eeea',
  label: '#5b6660',
  tick: '#5b6660',
  surface: '#fcfdfc',
  series1: '#2a78d6',
  series2: '#eb6834',
  series3: '#1baf7a',
  series4: '#eda100',
  series5: '#e87ba4',
};

/** The five series colours as a list, so a chart can pick one by its slot. */
export function seriesColours(c: ChartColors): string[] {
  return [c.series1, c.series2, c.series3, c.series4, c.series5];
}

/** Maps token triplets ("4 120 87") to rgb() colours, falling back per token. */
export function chartColorsFrom(read: (name: string) => string): ChartColors {
  const out = {} as ChartColors;
  for (const key of Object.keys(TOKENS) as (keyof ChartColors)[]) {
    const value = read(TOKENS[key]).trim();
    out[key] = value ? `rgb(${value})` : FALLBACK[key];
  }
  return out;
}

const NAMES = [...new Set(Object.values(TOKENS))];

function snapshot(): string {
  const style = getComputedStyle(document.documentElement);
  return NAMES.map((n) => style.getPropertyValue(n).trim()).join('|');
}

function subscribe(onChange: () => void) {
  // The theme flips via <html data-theme> or the OS colour scheme.
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
  mql?.addEventListener('change', onChange);
  return () => {
    observer.disconnect();
    mql?.removeEventListener('change', onChange);
  };
}

/**
 * Chart colours from the theme tokens. Recharts takes colours as props, not
 * CSS, so charts re-render with these when the theme changes.
 */
export function useChartColors(): ChartColors {
  const snap = useSyncExternalStore(subscribe, snapshot, () => '');
  return useMemo(() => {
    const values = snap.split('|');
    return chartColorsFrom((name) => values[NAMES.indexOf(name)] ?? '');
  }, [snap]);
}
