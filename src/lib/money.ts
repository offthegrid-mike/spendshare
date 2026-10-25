export function toCents(input: string | number): number {
  const n = typeof input === 'number' ? input : parseFloat(input);
  return Math.round(n * 100);
}
/** Cents as currency; a negative amount (a refund, say) gets a true minus sign: −A$12.50. */
export function formatMoney(cents: number, currency: string, locale = 'en-US'): string {
  const formatted = new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Math.abs(cents) / 100);
  return cents < 0 ? `−${formatted}` : formatted;
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

/** Cents as a plain figure for the expense list (12.50), with a true minus sign when negative. */
export function plainSigned(cents: number): string {
  const figure = (Math.abs(cents) / 100).toFixed(2);
  return cents < 0 ? `−${figure}` : figure;
}

/** Short axis-label form, e.g. 123456 cents → "$1.2K". Not for exact figures. */
export function formatCompactMoney(cents: number, currency: string, locale = 'en-US'): string {
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(Math.abs(cents) / 100);
  return cents < 0 ? `−${formatted}` : formatted;
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
