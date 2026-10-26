import { format } from 'date-fns';
import { formatMoney } from './money';
import { daysInMonthKey, formatDayMonth } from './month';
import { isRefund } from './refund';
import { collapseWhitespace, normalizeNameKey } from './textNormalize';
import type { ExpenseDoc, ItemDoc, LastPrice } from '../types/models';

/** One purchase of an item: what a single one cost, where, and when. */
export interface PricePoint {
  /** 'YYYY-MM-DD' */
  date: string;
  shop: string;
  /** Cents for one. */
  unit: number;
  expenseId: string;
}

export interface ShopPrices {
  /** The shop as it was last written. */
  shop: string;
  count: number;
  min: number;
  max: number;
  /** Average unit price, in whole cents. */
  mean: number;
  latest: PricePoint;
}

export interface PriceChange {
  /** How far back the comparison reaches. */
  months: number;
  /** The last purchase made on or before that long before the latest one. */
  from: PricePoint;
  to: PricePoint;
  /** Percent, negative when the price has fallen. */
  pct: number;
}

export interface PriceHistory {
  /** The item as it was last written. */
  name: string;
  /** Oldest first. */
  points: PricePoint[];
  latest: PricePoint | null;
  /** Cheapest on average first. */
  shops: ShopPrices[];
  changes: PriceChange[];
}

const CHANGE_MONTHS = [6, 12];

/**
 * What one of an item cost, in whole cents: the stored unit price, else the line
 * total divided by the quantity. 0 when it has no price to speak of.
 */
export function unitPrice(item: Pick<ItemDoc, 'amount' | 'quantity' | 'unitAmount'>): number {
  if (typeof item.unitAmount === 'number' && item.unitAmount > 0) return Math.round(item.unitAmount);
  const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
  return Math.max(Math.round(item.amount / quantity), 0);
}

/** The day an expense was made, 'YYYY-MM-DD' in local time. */
export function purchaseDate(expense: Pick<ExpenseDoc, 'date'>): string {
  return format(expense.date.toDate(), 'yyyy-MM-dd');
}

/** `date` some months earlier, with the day cut back to fit a shorter month (31 Aug less 6 months is 28 Feb). */
function monthsBefore(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const index = year * 12 + (month - 1) - months;
  const ym = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
  return `${ym}-${String(Math.min(day, daysInMonthKey(ym))).padStart(2, '0')}`;
}

/**
 * Every purchase of an item across a group's history, with what it cost where. Items
 * match by exact name once case and spacing are set aside, never by similar names.
 * Refunds are left out, as are lines with no price.
 */
export function computePriceHistory(
  name: string,
  expenses: ExpenseDoc[],
  itemsByExpense: Record<string, ItemDoc[]>,
): PriceHistory {
  const key = normalizeNameKey(name);
  const found: { point: PricePoint; itemName: string }[] = [];
  for (const expense of expenses) {
    if (isRefund(expense)) continue;
    for (const item of itemsByExpense[expense.id] ?? []) {
      if (item.refund || normalizeNameKey(item.name) !== key) continue;
      const unit = unitPrice(item);
      if (unit <= 0) continue;
      found.push({
        point: {
          date: purchaseDate(expense),
          shop: collapseWhitespace(expense.shopName) || 'Unnamed shop',
          unit,
          expenseId: expense.id,
        },
        itemName: collapseWhitespace(item.name),
      });
    }
  }
  found.sort((a, b) => a.point.date.localeCompare(b.point.date) || a.point.expenseId.localeCompare(b.point.expenseId));

  const points = found.map((f) => f.point);
  const latest = points[points.length - 1] ?? null;
  return {
    name: found[found.length - 1]?.itemName || collapseWhitespace(name),
    points,
    latest,
    shops: shopPrices(points),
    changes: latest ? priceChanges(points, latest) : [],
  };
}

function shopPrices(points: PricePoint[]): ShopPrices[] {
  const sums = new Map<string, { shop: string; total: number; count: number; min: number; max: number; latest: PricePoint }>();
  for (const point of points) {
    const shopKey = normalizeNameKey(point.shop);
    const entry = sums.get(shopKey);
    if (entry) {
      entry.shop = point.shop; // the newest spelling wins
      entry.total += point.unit;
      entry.count += 1;
      entry.min = Math.min(entry.min, point.unit);
      entry.max = Math.max(entry.max, point.unit);
      entry.latest = point;
    } else {
      sums.set(shopKey, { shop: point.shop, total: point.unit, count: 1, min: point.unit, max: point.unit, latest: point });
    }
  }
  return [...sums.values()]
    .map(({ total, ...rest }) => ({ ...rest, mean: Math.round(total / rest.count) }))
    .sort((a, b) => a.mean - b.mean || a.shop.localeCompare(b.shop));
}

function priceChanges(points: PricePoint[], latest: PricePoint): PriceChange[] {
  const changes: PriceChange[] = [];
  for (const months of CHANGE_MONTHS) {
    const target = monthsBefore(latest.date, months);
    const from = [...points].reverse().find((p) => p.date <= target);
    if (from) changes.push({ months, from, to: latest, pct: ((latest.unit - from.unit) * 100) / from.unit });
  }
  return changes;
}

/** 'A$3.40 at Coles, 12 Oct': what one cost, where and when. The shop is left out when there was none. */
export function formatLastPrice(last: LastPrice, currency: string): string {
  return `${formatMoney(last.unit, currency)}${last.shop ? ` at ${last.shop}` : ''}, ${formatDayMonth(last.date)}`;
}

/** One shop's line on the price chart. */
export interface PriceSeries {
  shop: string;
  /** 0-based, in the order the shops were first used, so a shop keeps its colour as new purchases come in. */
  slot: number;
  /** Oldest first. */
  points: PricePoint[];
}

/** The most lines a chart can tell apart. */
export const MAX_PRICE_SERIES = 5;

/**
 * A line per shop for the chart. When more shops have sold the item than the chart can
 * draw, it keeps the ones bought at most (the more recent on a tie) and counts the rest as hidden.
 */
export function priceSeries(history: PriceHistory, max = MAX_PRICE_SERIES): { series: PriceSeries[]; hidden: number } {
  const byShop = new Map<string, PricePoint[]>();
  for (const point of history.points) {
    const key = normalizeNameKey(point.shop);
    byShop.set(key, [...(byShop.get(key) ?? []), point]);
  }
  const lines = history.shops.map(({ shop }) => ({ shop, points: byShop.get(normalizeNameKey(shop)) ?? [] }));
  const newest = (line: { points: PricePoint[] }) => line.points[line.points.length - 1].date;
  const kept = [...lines]
    .sort((a, b) => b.points.length - a.points.length || newest(b).localeCompare(newest(a)) || a.shop.localeCompare(b.shop))
    .slice(0, max)
    .sort((a, b) => a.points[0].date.localeCompare(b.points[0].date) || a.shop.localeCompare(b.shop));
  return { series: kept.map((line, slot) => ({ ...line, slot })), hidden: lines.length - kept.length };
}

/** Whether an item's price page can be reached by name: not blank, and not dots only, which an address reads as a folder. */
export function canLinkPrices(name: string): boolean {
  return !/^\.*$/.test(collapseWhitespace(name));
}
