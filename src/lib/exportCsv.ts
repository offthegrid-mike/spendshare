import { csvLine, csvMoney } from './csv';
import { computeAdjustment } from './adjustment';
import { memberName } from './balance';
import { purchaseDate, unitPrice } from './priceHistory';
import { isRefund, signedAmount } from './refund';
import type { ExpenseDoc, GroupDoc, ItemDoc } from '../types/models';

// The item CSV: one row per item, for the month or year on the Summary screen.
// Pure; reading the data is exportData's job and saving the file is downloadFile's.

/** What an export covers: a month ('2026-10') or a whole year ('2026'). */
export type ExportPeriod = { kind: 'month'; month: string } | { kind: 'year'; year: string };

export const EXPENSES_HEADER = [
  'date',
  'shop',
  'paid_by',
  'item',
  'category',
  'quantity',
  'unit_price',
  'amount',
  'shared',
  'remark',
  'tags',
  'kind',
  'expense_id',
  'gift_card',
  'card_discount',
];

/** The first and last month ('YYYY-MM') of a period, both included. */
export function periodMonths(period: ExportPeriod): { from: string; to: string } {
  return period.kind === 'month'
    ? { from: period.month, to: period.month }
    : { from: `${period.year}-01`, to: `${period.year}-12` };
}

/** A name safe to put in a file name: lower case ASCII words joined by dashes, 'group' when none is left. */
export function fileSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'group';
}

/** 'spendshare-hartley-house-2026-10.csv' or 'spendshare-hartley-house-2026.csv'. */
export function csvFileName(group: Pick<GroupDoc, 'name'>, period: ExportPeriod): string {
  return `spendshare-${fileSlug(group.name)}-${period.kind === 'month' ? period.month : period.year}.csv`;
}

function yesNo(value: boolean): string {
  return value ? 'yes' : 'no';
}

/**
 * The header, then a row per item ordered by date, expense id and item id.
 * A refund's amounts are negative and its kind says so. An expense's gift card
 * and card discount sit on its first row only, so adding up the amount column
 * gives the same total as the Year summary. An expense with no items given still
 * gets a row, with its receipt total, so it is never dropped.
 */
export function buildExpensesCsv(
  group: GroupDoc,
  expenses: ExpenseDoc[],
  itemsByExpense: Record<string, ItemDoc[]>,
): string {
  const ordered = expenses
    .map((expense) => ({ expense, date: purchaseDate(expense) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.expense.id.localeCompare(b.expense.id));

  const rows = ordered.flatMap(({ expense, date }) => {
    const refund = isRefund(expense);
    const sign = refund ? -1 : 1;
    const { giftCard, discount } = computeAdjustment(expense);
    const items = [...(itemsByExpense[expense.id] ?? [])].sort((a, b) => a.id.localeCompare(b.id));
    const start = [date, expense.shopName, memberName(group, expense.payerUid)];
    const end = [refund ? 'refund' : 'purchase', expense.id];
    const adjustment = (first: boolean) =>
      first ? [giftCard > 0 ? csvMoney(sign * giftCard) : '', discount > 0 ? csvMoney(sign * discount) : ''] : ['', ''];

    if (items.length === 0) {
      return [csvLine([...start, '', '', '', '', csvMoney(sign * expense.total), '', '', '', ...end, ...adjustment(true)])];
    }
    return items.map((item, index) =>
      csvLine([
        ...start,
        item.name,
        item.category,
        item.quantity ?? 1,
        csvMoney(item.refund ? -unitPrice(item) : unitPrice(item)),
        csvMoney(signedAmount(item)),
        yesNo(item.shared),
        item.remark,
        (item.tags ?? []).join('; '),
        ...end,
        ...adjustment(index === 0),
      ]),
    );
  });

  return [csvLine(EXPENSES_HEADER), ...rows].join('');
}
