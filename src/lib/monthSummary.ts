import { collapseWhitespace, normalizeNameKey } from './textNormalize';
import { categoryTotals, type CategoryTotal } from './yearSummary';
import type { ExpenseDoc, IncomeDoc, ItemDoc } from '../types/models';

export type MonthItem = Pick<ItemDoc, 'expenseId' | 'category' | 'amount'>;
export type MonthExpense = Pick<ExpenseDoc, 'id' | 'shopName'>;
/** An expense of the previous month, whose date places its items within the month. */
export type PrevExpense = Pick<ExpenseDoc, 'id' | 'date'>;

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
  /** The previous month's expenses, to date its items. */
  prevExpenses: PrevExpense[];
  /**
   * The last day of the previous month to compare against, so a month in
   * progress is set beside the same days of the last one. null compares all of it.
   */
  prevThroughDay: number | null;
  /** Days of the month that have passed, the divisor for the daily average. */
  daysElapsed: number;
}

const TOP_SHOPS = 5;

const total = (items: MonthItem[]) => items.reduce((sum, it) => sum + Math.round(it.amount), 0);
const percentChange = (now: number, before: number) => ((now - before) * 100) / before;

/** The items of expenses dated on or before `day` of their month; all of them for null. Undated items are left out. */
function itemsThroughDay(items: MonthItem[], expenses: PrevExpense[], day: number | null): MonthItem[] {
  if (day === null) return items;
  const dayOf = new Map(expenses.map((e) => [e.id, e.date.toDate().getDate()]));
  return items.filter((it) => (dayOf.get(it.expenseId) ?? Infinity) <= day);
}

/** Everything the Summary's Month view shows beyond the settlement maths, from item amounts. */
export function computeMonthBreakdown({
  items, expenses, income, prevItems, prevExpenses, prevThroughDay, daysElapsed,
}: MonthBreakdownInput): MonthBreakdown {
  const spent = total(items);
  const incomeTotal = income.reduce((sum, i) => sum + i.amount, 0);
  const saved = incomeTotal - spent;

  const compared = prevItems ? itemsThroughDay(prevItems, prevExpenses, prevThroughDay) : [];
  const prevSpent = total(compared);
  const prevByCategory = new Map(categoryTotals(compared).map((c) => [c.category, c.amount]));
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
    dailyAverage: daysElapsed > 0 ? Math.round(spent / daysElapsed) : 0,
    biggestExpense,
    categories,
    topShops,
  };
}
