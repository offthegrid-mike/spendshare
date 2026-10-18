import { describeBalance, type BalanceTone } from './balance';
import { monthName } from './month';
import { computeSummary, type SummaryItem } from './settlement';
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
  const spent = items.reduce((sum, it) => sum + Math.round(it.amount), 0);
  const summary = computeSummary(group.memberUids, items, settlements);
  const balance = describeBalance(summary, viewerUid, group, monthLabel);
  return { monthLabel, spent, empty: false, balanceLabel: balance.label, balanceAmount: balance.amount, tone: balance.tone };
}
