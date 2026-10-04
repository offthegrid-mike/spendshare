export function toCents(input: string | number): number {
  const n = typeof input === 'number' ? input : parseFloat(input);
  return Math.round(n * 100);
}
export function formatMoney(cents: number, currency: string, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}
export function distributeEvenly(totalCents: number, ids: string[]): Record<string, number> {
  const n = ids.length;
  const out: Record<string, number> = {};
  if (n === 0) return out;
  const base = Math.floor(totalCents / n);
  let remainder = totalCents - base * n;
  for (const id of [...ids].sort()) { out[id] = base + (remainder-- > 0 ? 1 : 0); }
  return out;
}

/** Short axis-label form, e.g. 123456 cents → "$1.2K". Not for exact figures. */
export function formatCompactMoney(cents: number, currency: string, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

/** The currency symbol and the unsigned amount, for styling them separately ("A$" + "88.29"). */
export function splitMoney(cents: number, currency: string, locale = 'en-US'): { symbol: string; amount: string } {
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(Math.abs(cents) / 100);
  const symbol = parts.filter((p) => p.type === 'currency').map((p) => p.value).join('');
  const amount = parts
    .filter((p) => ['integer', 'group', 'decimal', 'fraction'].includes(p.type))
    .map((p) => p.value)
    .join('');
  return { symbol, amount };
}
