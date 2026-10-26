import { describeBalance, type BalanceTone } from './balance';
import { daysLeftText, percentUsed, tightestBudget, type BudgetRow, type BudgetStatus } from './budget';
import { formatMoney } from './money';
import { monthName } from './month';
import { computeSummary, type SummaryItem } from './settlement';
import { signedAmount } from './refund';
import type { GroupDoc, SettlementDoc } from '../types/models';

export interface SpendTileFigures {
  /** 'October' */
  monthLabel: string;
  /** Everything spent in the month, in cents. */
  spent: number;
  /** No expenses this month. */
  empty: boolean;
  balanceLabel: string;
  /** Cents, always positive; 0 when settled or empty. */
  balanceAmount: number;
  tone: BalanceTone;
}

/** The SpendShare tile on Home: the month's spending and the viewer's balance, as the Expenses hero reads them. */
export function spendTileFigures(
  group: GroupDoc,
  viewerUid: string,
  items: SummaryItem[],
  settlements: SettlementDoc[],
  month: string,
): SpendTileFigures {
  const monthLabel = monthName(month);
  if (items.length === 0) {
    return { monthLabel, spent: 0, empty: true, balanceLabel: 'Nothing to settle', balanceAmount: 0, tone: 'settled' };
  }
  const spent = items.reduce((sum, it) => sum + signedAmount(it), 0);
  const summary = computeSummary(group.memberUids, items, settlements);
  const balance = describeBalance(summary, viewerUid, group, monthLabel);
  return { monthLabel, spent, empty: false, balanceLabel: balance.label, balanceAmount: balance.amount, tone: balance.tone };
}

export interface BudgetTileLine {
  label: string;
  /** What sits at the right of the line: the amount over, or the days left. */
  note: string;
  tone: BudgetStatus;
}

/**
 * The one budget line on Home's tile, for the current month: the budget most
 * used once it is at 80% or more, otherwise that they are on track. null when
 * no category has a budget.
 */
export function budgetTileLine(rows: BudgetRow[], daysLeft: number, currency: string): BudgetTileLine | null {
  if (rows.length === 0) return null;
  const left = daysLeftText(daysLeft);
  const row = tightestBudget(rows);
  if (!row) return { label: 'Budgets on track', note: left, tone: 'ok' };
  if (row.remaining < 0) {
    return { label: `${row.name} over budget`, note: `${formatMoney(-row.remaining, currency)} over`, tone: 'over' };
  }
  if (row.remaining === 0) return { label: `${row.name} fully used`, note: left, tone: 'over' };
  return { label: `${row.name} ${percentUsed(row)}% used`, note: left, tone: 'warn' };
}
