import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { RouteSkeleton } from '../../components/AppSkeletons';
import { useAllExpenses } from '../../hooks/useAllExpenses';
import { formatMoney } from '../../lib/money';
import { formatDayMonth } from '../../lib/month';
import { paths } from '../../lib/paths';
import { computePriceHistory, priceSeries, type PriceChange } from '../../lib/priceHistory';
import type { GroupDoc } from '../../types/models';
import PriceChart from './PriceChart';

/** The newest purchases listed; the chart and shop list still count them all. */
const PURCHASES_SHOWN = 30;

const dayWithYear = (date: string) => `${formatDayMonth(date)} ${date.slice(0, 4)}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function ChangeRow({ change, currency }: { change: PriceChange; currency: string }) {
  const pct = Math.abs(change.pct).toFixed(1);
  const flat = pct === '0.0';
  const Icon = change.pct > 0 ? TrendingUp : TrendingDown;
  return (
    <li className="flex items-baseline justify-between gap-3 text-sm">
      <span className="min-w-0 text-ink-muted">
        {`vs ${change.months} months ago`}
        <span className="block text-xs">{`from ${formatMoney(change.from.unit, currency)} on ${dayWithYear(change.from.date)}`}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 font-medium text-ink">
        {!flat && <Icon size={14} strokeWidth={1.75} aria-hidden="true" />}
        {flat ? 'No change' : `${change.pct > 0 ? 'Up' : 'Down'} ${pct}%`}
      </span>
    </li>
  );
}

/** One item across the group's history: what it costs now, how that has moved, and where it is cheapest. */
export default function PriceScreen({ group, name }: { group: GroupDoc; name: string }) {
  const { expenses, itemsByExpense, loading, error } = useAllExpenses(group.id);
  const history = useMemo(() => computePriceHistory(name, expenses, itemsByExpense), [name, expenses, itemsByExpense]);
  const { series, hidden } = useMemo(() => priceSeries(history), [history]);

  if (error) return <p className="text-sm text-negative">{error}</p>;
  if (loading) return <RouteSkeleton />;

  const { latest, shops, points } = history;
  const currency = group.currency;
  if (!latest) {
    return (
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-ink">{history.name}</h2>
        <p className="px-1 py-8 text-center text-sm text-ink-muted">No purchases of “{history.name}” yet.</p>
      </div>
    );
  }

  // A second horizon that rests on the same purchase as the first says nothing more.
  const changes = history.changes.filter((c, i) => i === 0 || c.from.expenseId !== history.changes[0].from.expenseId);
  const cheapest = shops.length >= 2 ? shops[0] : null;
  const slotOf = new Map(series.map((s) => [s.shop, s.slot]));
  const keyed = series.length >= 2;
  const recent = [...points].reverse().slice(0, PURCHASES_SHOWN);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-ink">{history.name}</h2>
        <p className="money text-[28px] font-semibold tracking-[-0.03em] text-ink">{formatMoney(latest.unit, currency)}</p>
        <p className="text-xs text-ink-muted">{`at ${latest.shop}, ${formatDayMonth(latest.date)}`}</p>
        {cheapest && (
          <p className="text-xs text-ink-muted">{`Cheapest at ${cheapest.shop}, ${formatMoney(cheapest.mean, currency)} on average`}</p>
        )}
      </div>

      {changes.length > 0 && (
        <ul aria-label="Price change" className="card space-y-2 px-4 py-3">
          {changes.map((change) => <ChangeRow key={change.months} change={change} currency={currency} />)}
        </ul>
      )}

      {points.length >= 2 ? (
        <section className="card space-y-2 p-3">
          <PriceChart series={series} currency={currency} />
          {hidden > 0 && (
            <p className="px-1 text-xs text-ink-muted">
              {`The chart shows the ${series.length} shops bought at most; ${hidden === 1 ? '1 other is' : `${hidden} others are`} in the list below.`}
            </p>
          )}
        </section>
      ) : (
        <p className="px-1 text-xs text-ink-muted">The chart appears once there are two purchases.</p>
      )}

      <section aria-labelledby="price-shops" className="space-y-2">
        <h3 id="price-shops" className="px-1 text-xs font-medium text-ink-muted">By shop</h3>
        <ul aria-labelledby="price-shops" className="card divide-y divide-line overflow-hidden">
          {shops.map((shop) => {
            const slot = slotOf.get(shop.shop);
            return (
              <li key={shop.shop} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: keyed && slot !== undefined ? `rgb(var(--series-${slot + 1}))` : 'transparent' }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{shop.shop}</span>
                  <span className="block text-xs text-ink-muted">
                    {shop.count === 1
                      ? `1 purchase on ${formatDayMonth(shop.latest.date)}`
                      : `${shop.count} purchases, latest ${formatMoney(shop.latest.unit, currency)} on ${formatDayMonth(shop.latest.date)}`}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="money block text-sm font-semibold text-ink">{formatMoney(shop.mean, currency)}</span>
                  {shop.min !== shop.max && (
                    <span className="money block text-xs text-ink-muted">
                      {`${formatMoney(shop.min, currency)}–${formatMoney(shop.max, currency)}`}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="price-purchases" className="space-y-2">
        <h3 id="price-purchases" className="px-1 text-xs font-medium text-ink-muted">Purchases</h3>
        <ul aria-labelledby="price-purchases" className="card divide-y divide-line overflow-hidden">
          {recent.map((point) => (
            <li key={point.expenseId}>
              <Link
                to={paths.editExpense(point.expenseId)}
                className="flex min-h-[48px] items-center gap-3 px-4 py-2.5 transition hover:bg-recessed"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{point.shop}</span>
                  <span className="block text-xs text-ink-muted">{dayWithYear(point.date)}</span>
                </span>
                <span className="money shrink-0 text-sm font-semibold text-ink">{formatMoney(point.unit, currency)}</span>
              </Link>
            </li>
          ))}
        </ul>
        {points.length > PURCHASES_SHOWN && (
          <p className="px-1 text-xs text-ink-muted">
            {`Showing the latest ${PURCHASES_SHOWN} of ${plural(points.length, 'purchase', 'purchases')}.`}
          </p>
        )}
      </section>
    </div>
  );
}
