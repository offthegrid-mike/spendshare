import { CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '../../lib/money';
import { formatDayMonth, formatDayMonthYear, formatShortMonthYear } from '../../lib/month';
import type { PricePoint, PriceSeries } from '../../lib/priceHistory';
import { dayDate, dayNumber, timeTicks } from '../../lib/timeTicks';
import { seriesColours, useChartColors } from '../../hooks/useChartColors';

const MONO = '"Geist Mono Variable", ui-monospace, monospace';
const MARKER_RADIUS = 5;
const HIT_RADIUS = 12;

interface Mark extends PricePoint {
  /** Day number, for the date axis. */
  day: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: Mark }[];
  currency: string;
}

/** One purchase: the price first, then where and when. */
function PurchaseTooltip({ active, payload, currency }: TooltipProps) {
  const mark = active ? payload?.[0]?.payload : undefined;
  if (!mark) return null;
  return (
    <div className="rounded-[10px] border border-line bg-surface px-3 py-2 shadow-pop">
      <p className="money text-sm font-semibold text-ink">{formatMoney(mark.unit, currency)}</p>
      <p className="text-xs text-ink-muted">{`${mark.shop} · ${formatDayMonthYear(mark.date)}`}</p>
    </div>
  );
}

/** One line per shop, a marker per purchase, over a time axis. */
export default function PriceChart({ series, currency }: { series: PriceSeries[]; currency: string }) {
  const c = useChartColors();
  const colours = seriesColours(c);
  const lines = series.map((s) => ({
    ...s,
    colour: colours[s.slot],
    marks: s.points.map((p): Mark => ({ ...p, day: dayNumber(p.date) })),
  }));

  const days = lines.flatMap((l) => l.marks.map((m) => m.day));
  const first = Math.min(...days);
  const last = Math.max(...days);
  // Room either side so the end markers aren't cut off.
  const pad = Math.max(2, Math.round((last - first) * 0.04));
  const { ticks, unit } = timeTicks(first, last);
  const tickLabel = (day: number) => {
    const date = dayDate(day);
    return unit === 'month' ? formatShortMonthYear(date) : formatDayMonth(date);
  };
  const tick = { fill: c.tick, fontFamily: MONO };

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis
            type="number"
            dataKey="day"
            domain={[first - pad, last + pad]}
            ticks={ticks}
            tickFormatter={tickLabel}
            tickLine={false}
            axisLine={{ stroke: c.grid }}
            fontSize={11}
            tick={{ fill: c.tick }}
          />
          <YAxis
            type="number"
            dataKey="unit"
            width={56}
            domain={[
              (min: number) => Math.max(0, Math.floor((min * 0.95) / 10) * 10),
              (max: number) => Math.ceil((max * 1.05) / 10) * 10,
            ]}
            allowDecimals={false}
            tickFormatter={(v: number) => formatMoney(Math.round(v), currency)}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            tick={tick}
          />
          <Tooltip cursor={false} content={<PurchaseTooltip currency={currency} />} />
          {lines.length >= 2 && (
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => <span style={{ color: c.label }}>{value}</span>}
            />
          )}
          {lines.map((l) => (
            <Scatter
              key={l.shop}
              name={l.shop}
              data={l.marks}
              fill={l.colour}
              line={{ stroke: l.colour, strokeWidth: 2 }}
              lineType="joint"
              isAnimationActive={false}
              shape={({ cx, cy }: { cx?: number; cy?: number }) => (
                <g>
                  {/* A larger invisible target than the marker, for touch and for hovering. */}
                  <circle cx={cx} cy={cy} r={HIT_RADIUS} fill="transparent" />
                  <circle cx={cx} cy={cy} r={MARKER_RADIUS} fill={l.colour} stroke={c.surface} strokeWidth={2} />
                </g>
              )}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
