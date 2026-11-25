/** `total` split in proportion to `amounts`, rounded so the parts add up to it; ties go to the earlier part. */
export function spreadInProportion(total: number, amounts: number[]): number[] {
  const sum = amounts.reduce((s, a) => s + a, 0);
  if (sum <= 0) return amounts.map(() => 0);
  const exact = amounts.map((a) => (total * a) / sum);
  const parts = exact.map(Math.floor);
  let left = total - parts.reduce((s, p) => s + p, 0);
  const byFraction = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of byFraction) {
    if (left <= 0) break;
    parts[i] += 1;
    left -= 1;
  }
  return parts;
}
