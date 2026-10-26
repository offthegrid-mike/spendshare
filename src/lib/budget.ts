import { daysElapsedInMonth, daysInMonthKey } from './month';
import { toCents } from './money';
import { signedAmount } from './refund';
import type { CategoryDoc, ItemDoc } from '../types/models';

export type BudgetCategory = Pick<CategoryDoc, 'id' | 'name' | 'order' | 'archived' | 'monthlyBudget'>;
export type BudgetItem = Pick<ItemDoc, 'categoryId' | 'amount' | 'refund'>;
export type BudgetStatus = 'ok' | 'warn' | 'over';

export interface BudgetRow {
  categoryId: string;
  name: string;
  /** Everything spent in the category this month, shared or personal, less refunds. */
  spent: number;
  /** The monthly budget, in cents. */
  limit: number;
  /** What is left; negative once over budget. */
  remaining: number;
  /** Percent of the limit used, 0 when refunds outweigh spending. */
  pct: number;
  status: BudgetStatus;
}

export interface BudgetProgress {
  rows: BudgetRow[];
  /** Percent of the month that has passed, for a month in progress; null for a finished or future one. */
  pace: number | null;
  /** Days of the month still to come; 0 once it is over. */
  daysLeft: number;
}

/** Budgets turn amber at this share of the limit used, and red at the whole of it. */
const WARN_PCT = 80;
const OVER_PCT = 100;

/** The most a budget can be, in cents, so a typo can't store something absurd. */
const MAX_BUDGET_CENTS = 1_000_000_000;

/** A category with a budget above zero; a missing, zero or negative one has none. */
export function hasBudget<T extends Pick<CategoryDoc, 'monthlyBudget'>>(category: T): category is T & { monthlyBudget: number } {
  return typeof category.monthlyBudget === 'number' && category.monthlyBudget > 0;
}

/** The percent used as shown: rounded down, so 79.6% isn't "80%" without the amber, nor 99.6% "100%" while still under. */
export function percentUsed(row: Pick<BudgetRow, 'pct'>): number {
  return Math.floor(row.pct);
}

/** '12 days left', '1 day left', or 'Last day' once none are left. */
export function daysLeftText(daysLeft: number): string {
  if (daysLeft === 0) return 'Last day';
  return `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`;
}

/**
 * How each budgeted category is doing in `month`. Spending is every item in the
 * category (shared and personal) by `signedAmount`, the figure the Summary's
 * By category card shows, matched by category id so a rename keeps its spending.
 * Each month starts from the full limit: nothing carries over.
 */
export function computeBudgetProgress(
  items: BudgetItem[],
  categories: BudgetCategory[],
  month: string,
  now: number = Date.now(),
): BudgetProgress {
  const spentBy = new Map<string, number>();
  for (const it of items) spentBy.set(it.categoryId, (spentBy.get(it.categoryId) ?? 0) + signedAmount(it));

  const rows: BudgetRow[] = [...categories]
    .sort((a, b) => a.order - b.order)
    .flatMap((c): BudgetRow[] => {
      if (c.archived || !hasBudget(c)) return [];
      const limit = c.monthlyBudget;
      const spent = spentBy.get(c.id) ?? 0;
      // Compared in whole cents (spent × 100 against limit × percent), not as floats.
      const status: BudgetStatus =
        spent * 100 >= limit * OVER_PCT ? 'over' : spent * 100 >= limit * WARN_PCT ? 'warn' : 'ok';
      return [{
        categoryId: c.id,
        name: c.name,
        spent,
        limit,
        remaining: limit - spent,
        pct: spent > 0 ? (spent * 100) / limit : 0,
        status,
      }];
    });

  const elapsed = daysElapsedInMonth(month, now);
  const total = daysInMonthKey(month);
  return {
    rows,
    // The last day isn't "in progress": the month is as good as over.
    pace: elapsed > 0 && elapsed < total ? (elapsed * 100) / total : null,
    daysLeft: total - elapsed,
  };
}

/** The budget closest to or furthest past its limit, once it is at 80% or more; null if none is. Earlier categories win a tie. */
export function tightestBudget(rows: BudgetRow[]): BudgetRow | null {
  let tightest: BudgetRow | null = null;
  for (const row of rows) {
    if (row.status === 'ok') continue;
    if (!tightest || row.pct > tightest.pct) tightest = row;
  }
  return tightest;
}

/**
 * What was typed in the budget field: null for blank (remove the budget), the
 * amount in cents, or 'invalid'. A leading currency symbol, spaces and commas
 * between thousands are fine; zero, negatives, more than two decimals and a
 * decimal comma ("400,50") are not.
 */
export function parseBudgetInput(text: string): number | null | 'invalid' {
  if (!text.trim()) return null;
  const cleaned = text.replace(/\s/g, '').replace(/^[A-Za-z]{0,3}[$€£]/, '');
  if (!/^(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{0,2})?|\.\d{1,2})$/.test(cleaned)) return 'invalid';
  const cents = toCents(cleaned.replace(/,/g, ''));
  return cents > 0 && cents <= MAX_BUDGET_CENTS ? cents : 'invalid';
}
