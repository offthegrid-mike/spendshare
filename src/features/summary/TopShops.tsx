import { formatMoney } from '../../lib/money';
import type { ShopTotal } from '../../lib/monthSummary';

interface Props {
  shops: ShopTotal[];
  currency: string;
}

/** The month's biggest shops by spend, with how often they were visited. */
export default function TopShops({ shops, currency }: Props) {
  if (shops.length === 0) return null;

  return (
    <section className="card p-5">
      <h2 className="mb-3 text-base font-semibold text-ink">Top shops</h2>
      <ol className="divide-y divide-line">
        {shops.map((s) => (
          <li key={s.shopName} data-testid="shop-row" className="flex items-baseline justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{s.shopName}</span>
              <span className="text-xs text-ink-muted">{s.visits} {s.visits === 1 ? 'visit' : 'visits'}</span>
            </span>
            <span className="money shrink-0 text-ink">{formatMoney(s.amount, currency)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
