/**
 * Money in any currency, held as whole minor units of that currency: yen
 * have none (¥1,500 → 1500), dollars have cents (A$12.50 → 1250) and
 * Kuwaiti dinar have fils (KWD 1.234 → 1234). Household screens keep using
 * the cents helpers in ../money; trip screens use these.
 */

const LOCALE = 'en-US';
const FALLBACK_DIGITS = 2;

// Building an Intl.NumberFormat is slow, and trip lists format hundreds of amounts.
const formatters = new Map<string, Intl.NumberFormat | null>();

/** The cached formatter, or null for an empty or unknown code (Intl would throw). */
function formatter(currency: string, locale = LOCALE): Intl.NumberFormat | null {
  const code = currency.toUpperCase();
  const key = `${locale}|${code}`;
  let f = formatters.get(key);
  if (f === undefined) {
    try {
      f = new Intl.NumberFormat(locale, { style: 'currency', currency: code });
    } catch {
      f = null;
    }
    formatters.set(key, f);
  }
  return f;
}

/** How many decimals the currency's minor unit has: JPY 0, AUD 2, KWD 3 (2 for an unknown code). */
export function minorDigits(currency: string): number {
  return formatter(currency)?.resolvedOptions().maximumFractionDigits ?? FALLBACK_DIGITS;
}

/**
 * The typed text as a plain decimal number string. With both '.' and ',',
 * the later one is the decimal mark ("1.234,50" and "1,234.50"). A lone
 * comma before one or two final digits is a decimal comma ("12,50"), unless
 * the currency has no decimals; any other comma groups thousands ("1,500").
 */
function normalise(text: string, digits: number): string {
  const s = text.replace(/\s/g, '');
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    return lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  }
  if (digits > 0 && /^[^,]*,\d{1,2}$/.test(s)) return s.replace(',', '.');
  return s.replace(/,/g, '');
}

/** A typed or numeric amount in the currency's minor units. Anything that isn't a number gives NaN. */
export function toMinor(input: string | number, currency: string): number {
  const digits = minorDigits(currency);
  const n = typeof input === 'number' ? input : Number(normalise(input, digits) || NaN);
  if (!Number.isFinite(n)) return NaN;
  // toFixed rounds the decimal string first, which avoids 0.29 * 100 = 28.999…
  return Math.round(Number(n.toFixed(digits)) * 10 ** digits);
}

/** Minor units as currency, with a true minus sign when negative: −A$12.50, ¥15,000. */
export function formatMinor(amount: number, currency: string, locale = LOCALE): string {
  const f = formatter(currency, locale);
  const digits = f?.resolvedOptions().maximumFractionDigits ?? FALLBACK_DIGITS;
  const figure = Math.abs(amount) / 10 ** digits;
  const code = currency.trim().toUpperCase();
  const formatted = f ? f.format(figure) : `${code ? `${code} ` : ''}${figure.toFixed(digits)}`;
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
