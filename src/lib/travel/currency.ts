/**
 * Money in any currency, held as whole minor units of that currency: yen
 * have none (¥1,500 → 1500), dollars have cents (A$12.50 → 1250) and
 * Kuwaiti dinar have fils (KWD 1.234 → 1234). Household screens keep using
 * the cents helpers in ../money; trip screens use these.
 */

const LOCALE = 'en-US';

function formatter(currency: string, locale = LOCALE): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase() });
}

/** How many decimals the currency's minor unit has: JPY 0, AUD 2, KWD 3. */
export function minorDigits(currency: string): number {
  return formatter(currency).resolvedOptions().maximumFractionDigits ?? 2;
}

/**
 * A typed or numeric amount in the currency's minor units. Commas and spaces
 * are read as thousands separators. Anything that isn't a number gives NaN.
 */
export function toMinor(input: string | number, currency: string): number {
  const n = typeof input === 'number' ? input : Number(input.replace(/[\s,]/g, '') || NaN);
  if (!Number.isFinite(n)) return NaN;
  // toFixed rounds the decimal string first, which avoids 0.29 * 100 = 28.999…
  const digits = minorDigits(currency);
  return Math.round(Number(n.toFixed(digits)) * 10 ** digits);
}

/** Minor units as currency, with a true minus sign when negative: −A$12.50, ¥15,000. */
export function formatMinor(amount: number, currency: string, locale = LOCALE): string {
  const digits = minorDigits(currency);
  const formatted = formatter(currency, locale).format(Math.abs(amount) / 10 ** digits);
  return amount < 0 ? `−${formatted}` : formatted;
}

/** Currencies offered in pickers, most-travelled first after the four household ones. */
const TRAVEL_CURRENCIES = [
  'AUD', 'USD', 'EUR', 'GBP', 'NZD', 'JPY', 'KRW', 'CNY', 'HKD', 'TWD', 'SGD', 'MYR',
  'THB', 'IDR', 'VND', 'PHP', 'INR', 'CAD', 'CHF', 'AED', 'FJD', 'MXN', 'ZAR', 'KWD',
];

export interface CurrencyOption { code: string; name: string; }

export function currencyOptions(): CurrencyOption[] {
  const names = new Intl.DisplayNames([LOCALE], { type: 'currency' });
  return TRAVEL_CURRENCIES.map((code) => ({ code, name: names.of(code) ?? code }));
}
