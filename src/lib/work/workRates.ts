// Built-in fixed rate (cents per hour) for the working-from-home method, by
// income year (1 July to 30 June, keyed like '2025-26').
export const KNOWN_RATES: Record<string, number> = {
  '2020-21': 52,
  '2021-22': 52,
  '2022-23': 67,
  '2023-24': 67,
  '2024-25': 70,
  '2025-26': 70,
};

export interface ResolvedRate {
  cents: number;
  source: 'set' | 'known' | 'carried';
  carriedFrom?: string;
}

// The stored rates map is only checked to be a map, so a value in it can be a
// null, a string, NaN or negative. Only a finite number of 0 or more is a rate;
// 0 is the user's choice and is kept.
function isUsableRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

// A rate the user set for that exact year wins, then the built-in rate for it.
// With neither, the rate of the latest known year before it is carried forward
// (or the earliest known year's rate, for a year before every known year).
// Keys are zero-padded 'YYYY-YY' strings, so plain string comparison orders them.
// Only the user's own keys count, never an inherited one such as 'constructor',
// and an unusable user value falls through to the known and then carried rate.
export function resolveRate(
  incomeYear: string,
  userRates: Record<string, number>,
): ResolvedRate {
  if (Object.hasOwn(userRates, incomeYear)) {
    const cents: unknown = userRates[incomeYear];
    if (isUsableRate(cents)) return { cents, source: 'set' };
  }
  if (Object.hasOwn(KNOWN_RATES, incomeYear)) {
    return { cents: KNOWN_RATES[incomeYear], source: 'known' };
  }

  const years = Object.keys(KNOWN_RATES).sort();
  const before = years.filter((year) => year < incomeYear);
  const carriedFrom = before.length > 0 ? before[before.length - 1] : years[0];
  return { cents: KNOWN_RATES[carriedFrom], source: 'carried', carriedFrom };
}
