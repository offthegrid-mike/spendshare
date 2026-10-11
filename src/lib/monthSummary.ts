import { collapseWhitespace, normalizeNameKey } from './textNormalize';
import { categoryTotals, type CategoryTotal } from './yearSummary';
import type { ExpenseDoc, IncomeDoc, ItemDoc } from '../types/models';

export type MonthItem = Pick<ItemDoc, 'expenseId' | 'category' | 'amount'>;
export type MonthExpense = Pick<ExpenseDoc, 'id' | 'shopName'>;

export interface MonthCategory extends CategoryTotal {
  /** Percent change against the previous month, 'new' if it had none, null with nothing to compare. */
  change: number | 'new' | null;
}
export interface ShopTotal { shopName: string; amount: number; visits: number; }

export interface MonthBreakdown {
  spent: number;
  income: number;
  /** Income minus spending; negative when overspent. */
  saved: number;
  /** Percent of income left over; null without income. */
  savingsRate: number | null;
  /** Spending against the previous month; null while it loads or if it had none. */
  vsPrev: { amount: number; pct: number } | null;
  /** True when `vsPrev` and the category changes are against a share of last month, not all of it. */
  paced: boolean;
  dailyAverage: number;
  biggestExpense: { shopName: string; amount: number } | null;
  categories: MonthCategory[];
  topShops: ShopTotal[];
}

export interface MonthBreakdownInput {
  items: MonthItem[];
  expenses: MonthExpense[];
  income: Pick<IncomeDoc, 'amount'>[];
  /** The previous month's items, or null while they load. */
  prevItems: MonthItem[] | null;
  /** The share of the previous month to compare against: 1 once this month is over, less while it is in progress. */
  prevScale: number;
  /** Days of the month that have passed, the divisor for the daily average. */
  daysElapsed: number;
}

const TOP_SHOPS = 5;

const total = (items: MonthItem[]) => items.reduce((sum, it) => sum + Math.round(it.amount), 0);
const percentChange = (now: number, before: number) => ((now - before) * 100) / before;

/** Everything the Summary's Month view shows beyond the settlement maths, from item amounts. */
export function computeMonthBreakdown({
  items, expenses, income, prevItems, prevScale, daysElapsed,
}: MonthBreakdownInput): MonthBreakdown {
  const spent = total(items);
  const incomeTotal = income.reduce((sum, i) => sum + i.amount, 0);
  const saved = incomeTotal - spent;

  const scaled = (cents: number) => Math.round(cents * prevScale);
  const prevSpent = prevItems ? scaled(total(prevItems)) : 0;
  const prevByCategory = new Map(categoryTotals(prevItems ?? []).map((c) => [c.category, scaled(c.amount)]));
  const categories: MonthCategory[] = categoryTotals(items).map((c) => {
    const before = prevByCategory.get(c.category);
    let change: MonthCategory['change'] = null;
    if (prevSpent > 0) change = before ? percentChange(c.amount, before) : 'new';
    return { ...c, change };
  });

  const spentByExpense = new Map<string, number>();
  for (const it of items) {
    spentByExpense.set(it.expenseId, (spentByExpense.get(it.expenseId) ?? 0) + Math.round(it.amount));
  }
  const expenseById = new Map(expenses.map((e) => [e.id, e]));
  // Biggest first, ties by name, so what is shown doesn't depend on snapshot order.
  const visits = [...spentByExpense].flatMap(([id, amount]) => {
    const expense = expenseById.get(id);
    return expense ? [{ id, amount, shopName: collapseWhitespace(expense.shopName) || 'Unnamed shop' }] : [];
  }).sort((a, b) => b.amount - a.amount || a.shopName.localeCompare(b.shopName) || a.id.localeCompare(b.id));

  const shops = new Map<string, ShopTotal>();
  for (const { amount, shopName } of visits) {
    const key = normalizeNameKey(shopName);
    const shop = shops.get(key) ?? { shopName, amount: 0, visits: 0 };
    shop.amount += amount;
    shop.visits += 1;
    shops.set(key, shop);
  }
  const topShops = [...shops.values()]
    .sort((a, b) => b.amount - a.amount || b.visits - a.visits || a.shopName.localeCompare(b.shopName))
    .slice(0, TOP_SHOPS);
  const biggest = visits[0];
  const biggestExpense = biggest && biggest.amount > 0 ? { shopName: biggest.shopName, amount: biggest.amount } : null;

  return {
    spent,
    income: incomeTotal,
    saved,
    savingsRate: incomeTotal > 0 ? (saved * 100) / incomeTotal : null,
    vsPrev: prevSpent > 0 ? { amount: spent - prevSpent, pct: percentChange(spent, prevSpent) } : null,
    paced: prevScale !== 1,
    dailyAverage: daysElapsed > 0 ? Math.round(spent / daysElapsed) : 0,
    biggestExpense,
    categories,
    topShops,
  };
}
