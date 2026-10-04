import {
  Bar, BarChart, CartesianGrid, LabelList, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatCompactMoney, formatMoney } from '../../lib/money';
import type { CategoryTotal, MonthTotals } from '../../lib/yearSummary';
import { useChartColors } from '../../hooks/useChartColors';

const MONO = '"Geist Mono Variable", ui-monospace, monospace';

interface MonthChartProps {
  months: MonthTotals[];
  currency: string;
  avgSpending: number;
  avgIncome: number;
  onSelectMonth: (month: string) => void;
}

export function MonthChart({ months, currency, avgSpending, avgIncome, onSelectMonth }: MonthChartProps) {
  const c = useChartColors();
  const money = (v: unknown) => formatMoney(Number(v), currency);
  const select = (_: unknown, index: number) => onSelectMonth(months[index].month);
  const tick = { fill: c.tick };
  const tooltip = { background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 10, color: c.income };
  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={months} barGap={2} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="label" interval={0} tickLine={false} axisLine={false} fontSize={11} tick={tick} />
          <YAxis
            width={48}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            tick={{ ...tick, fontFamily: MONO }}
            tickFormatter={(v: number) => formatCompactMoney(v, currency)}
          />
          <Tooltip formatter={money} cursor={{ fill: c.cursor }} contentStyle={tooltip} />
          <Legend verticalAlign="bottom" iconType="circle" itemSorter={null} wrapperStyle={{ fontSize: 12, color: c.label }} />
          {/* Dashed average lines sit behind the bars, in each series' colour. */}
          <ReferenceLine y={avgSpending} stroke={c.spending} strokeDasharray="4 4" strokeOpacity={0.7} ifOverflow="extendDomain" />
          <ReferenceLine y={avgIncome} stroke={c.income} strokeDasharray="4 4" strokeOpacity={0.5} ifOverflow="extendDomain" />
          <Bar dataKey="spending" name="Spending" fill={c.spending} radius={[4, 4, 0, 0]} cursor="pointer" onClick={select} />
          <Bar dataKey="income" name="Income" fill={c.income} fillOpacity={0.85} radius={[4, 4, 0, 0]} cursor="pointer" onClick={select} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface CategoryChartProps {
  categories: CategoryTotal[];
  currency: string;
}

export function CategoryChart({ categories, currency }: CategoryChartProps) {
  const c = useChartColors();
  const data = categories.map((c) => ({
    ...c,
    label: `${formatMoney(c.amount, currency)} · ${Math.round(c.pct)}%`,
  }));
  const height = Math.max(data.length * 32 + 8, 72);
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 120, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="category" width={96} tickLine={false} axisLine={false} fontSize={12} tick={{ fill: c.tick }} />
          <Tooltip
            formatter={(v) => formatMoney(Number(v), currency)}
            cursor={{ fill: c.cursor }}
            contentStyle={{ background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 10, color: c.income }}
          />
          <Bar dataKey="amount" name="Spending" fill={c.spending} radius={[0, 4, 4, 0]} barSize={18}>
            <LabelList dataKey="label" position="right" fontSize={12} fill={c.label} fontFamily={MONO} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
