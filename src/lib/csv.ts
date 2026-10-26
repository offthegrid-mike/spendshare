export type Cell = string | number | null | undefined;

/** A CSV cell: empty for null or undefined, quoted when it holds a comma, a quote or a newline. */
export function csvEscape(value: Cell): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One CSV line, with its line break. */
export function csvLine(cells: Cell[]): string {
  return `${cells.map(csvEscape).join(',')}\n`;
}

/**
 * Cents as a plain decimal a spreadsheet reads as a number: a dot, two places,
 * no symbol, and an ASCII minus (money.ts's plainSigned uses a true minus sign).
 */
export function csvMoney(cents: number): string {
  const figure = (Math.abs(cents) / 100).toFixed(2);
  return cents < 0 ? `-${figure}` : figure;
}
