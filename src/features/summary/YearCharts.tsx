import {
  Bar, BarChart, CartesianGrid, LabelList, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatCompactMoney, formatMoney } from '../../lib/money';
import type { CategoryTotal, MonthTotals } from '../../lib/yearSummary';

// Not exported: react-refresh requires component files to export only components.
// Spending/Income pair checked with the dataviz validator (light, white surface): all checks pass.
const SPENDING_COLOR = '#059669'; // brand-600
const INCOME_COLOR = '#6366f1';   // indigo-500
const GRID_COLOR = '#e2e8f0';     // slate-200
const CURSOR_FILL = '#f1f5f9';    // slate-100
const LABEL_COLOR = '#475569';    // slate-600
const TICK = { fill: '#64748b' }; // slate-500 — axis text uses text ink, not series colour

interface MonthChartProps {
  months: MonthTotals[];
  currency: string;
  avgSpending: number;
  avgIncome: number;
  onSelectMonth: (month: string) => void;
}

export function MonthChart({ months, currency, avgSpending, avgIncome, onSelectMonth }: MonthChartProps) {
  const money = (v: unknown) => formatMoney(Number(v), currency);
  const select = (_: unknown, index: number) => onSelectMonth(months[index].month);
  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={months} barGap={2} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_COLOR} />
          <XAxis dataKey="label" interval={0} tickLine={false} axisLine={false} fontSize={11} tick={TICK} />
          <YAxis
            width={48}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            tick={TICK}
            tickFormatter={(v: number) => formatCompactMoney(v, currency)}
          />
          <Tooltip formatter={money} cursor={{ fill: CURSOR_FILL }} />
          <Legend verticalAlign="bottom" iconType="circle" itemSorter={null} wrapperStyle={{ fontSize: 12, color: LABEL_COLOR }} />
          {/* Dashed average lines sit behind the bars, in each series' colour. */}
          <ReferenceLine y={avgSpending} stroke={SPENDING_COLOR} strokeDasharray="4 4" strokeOpacity={0.7} ifOverflow="extendDomain" />
          <ReferenceLine y={avgIncome} stroke={INCOME_COLOR} strokeDasharray="4 4" strokeOpacity={0.7} ifOverflow="extendDomain" />
          <Bar dataKey="spending" name="Spending" fill={SPENDING_COLOR} radius={[4, 4, 0, 0]} cursor="pointer" onClick={select} />
          <Bar dataKey="income" name="Income" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} cursor="pointer" onClick={select} />
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
          <YAxis type="category" dataKey="category" width={96} tickLine={false} axisLine={false} fontSize={12} tick={TICK} />
          <Tooltip formatter={(v) => formatMoney(Number(v), currency)} cursor={{ fill: CURSOR_FILL }} />
          <Bar dataKey="amount" name="Spending" fill={SPENDING_COLOR} radius={[0, 4, 4, 0]} barSize={18}>
            <LabelList dataKey="label" position="right" fontSize={12} fill={LABEL_COLOR} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
