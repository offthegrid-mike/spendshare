import { computeSummary } from './settlement';
import { signedAmount } from './refund';
import type { IncomeDoc, ItemDoc, Uid } from '../types/models';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type YearItem = Pick<ItemDoc, 'amount' | 'shared' | 'payerUid' | 'month' | 'category' | 'refund'>;
export type YearIncome = Pick<IncomeDoc, 'uid' | 'amount' | 'month'>;

export interface PersonYear { paid: number; share: number; income: number; }
export interface MonthTotals { month: string; label: string; spending: number; income: number; }
export interface CategoryTotal { category: string; amount: number; pct: number; }

export interface YearSummary {
  grandTotal: number;
  sharedTotal: number;
  incomeTotal: number;
  net: number;
  perPerson: Record<Uid, PersonYear>;
  months: MonthTotals[];
  /** Months with any spending or income — the divisor for the averages. */
  activeMonths: number;
  avgSpending: number;
  avgIncome: number;
  categories: CategoryTotal[];
}

export function yearMonths(year: string): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

/** Spending per category, biggest first, each with its share of the total. */
export function categoryTotals(items: Pick<ItemDoc, 'amount' | 'category' | 'refund'>[]): CategoryTotal[] {
  const byCategory = new Map<string, number>();
  let total = 0;
  for (const it of items) {
    const name = it.category || 'Uncategorized';
    const amount = signedAmount(it);
    byCategory.set(name, (byCategory.get(name) ?? 0) + amount);
    total += amount;
  }
  return [...byCategory.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      // A category refunded below zero has no share of the spending.
      pct: total > 0 && amount > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
}

export function computeYearSummary(
  year: string,
  members: Uid[],
  items: YearItem[],
  income: YearIncome[],
): YearSummary {
  const monthKeys = yearMonths(year);
  const inYear = new Set(monthKeys);
  const yItems = items.filter((i) => inYear.has(i.month));
  const yIncome = income.filter((i) => inYear.has(i.month));

  // Reuse the monthly settlement math so rounding / equal-split stay in one place.
  const { paidTotal, shareOf, sharedTotal } = computeSummary(members, yItems, []);

  const grandTotal = yItems.reduce((sum, i) => sum + signedAmount(i), 0);
  const incomeTotal = yIncome.reduce((sum, i) => sum + i.amount, 0);

  const perPerson: Record<Uid, PersonYear> = {};
  for (const m of members) perPerson[m] = { paid: paidTotal[m] ?? 0, share: shareOf[m] ?? 0, income: 0 };
  for (const inc of yIncome) {
    if (perPerson[inc.uid]) perPerson[inc.uid].income += inc.amount;
  }

  const months: MonthTotals[] = monthKeys.map((month, i) => ({
    month, label: MONTH_SHORT[i], spending: 0, income: 0,
  }));
  const byMonth = new Map(months.map((m) => [m.month, m]));
  for (const it of yItems) byMonth.get(it.month)!.spending += signedAmount(it);
  for (const inc of yIncome) byMonth.get(inc.month)!.income += inc.amount;

  const categories = categoryTotals(yItems);

  const activeMonths = months.filter((m) => m.spending > 0 || m.income > 0).length;
  const average = (total: number) => (activeMonths > 0 ? Math.round(total / activeMonths) : 0);

  return {
    grandTotal,
    sharedTotal,
    incomeTotal,
    net: incomeTotal - grandTotal,
    perPerson,
    months,
    activeMonths,
    avgSpending: average(grandTotal),
    avgIncome: average(incomeTotal),
    categories,
  };
}

/** Keep the top `max - 1` categories and fold the rest into a single "Other" row. */
export function foldCategories(categories: CategoryTotal[], max = 10): CategoryTotal[] {
  if (categories.length <= max) return categories;
  const head = categories.slice(0, max - 1);
  const rest = categories.slice(max - 1);
  return [
    ...head,
    {
      category: 'Other',
      amount: rest.reduce((sum, c) => sum + c.amount, 0),
      pct: rest.reduce((sum, c) => sum + c.pct, 0),
    },
  ];
}
