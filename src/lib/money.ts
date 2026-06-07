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
