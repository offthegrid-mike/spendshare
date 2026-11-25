import { csvEscape } from '../work/workExport';
import { isKittyId, readableWalletRate, type TripCash } from './cash';
import { minorDigits } from './currency';
import { spreadInProportion } from './spread';
import { expenseDay, expenseHomeTotal, isEstimated } from './tripExpense';
import { tripMemberName } from './valueTrip';
import type { ExpenseDoc, GroupDoc, ItemDoc } from '../../types/models';

/**
 * The trip export (docs/TRAVEL_PLAN.md, T6): one CSV with a row per item, one
 * with every bit of cash bought, handed over and spent. Pure: the download is
 * downloadCsv's job. Text a person typed is kept from being read as a formula.
 */

type Cell = string | number | null | undefined;

/** Text a spreadsheet would run as a formula (led by = + - @, a tab or a return) gets a leading apostrophe. */
function text(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function line(cells: Cell[]): string {
  return `${cells.map(csvEscape).join(',')}\n`;
}

/** Minor units as a plain decimal in the currency's own digits: 15000 JPY → "15000", 15152 AUD → "151.52". */
function plain(amount: number, currency: string): string {
  const digits = minorDigits(currency);
  return (amount / 10 ** digits).toFixed(digits);
}

const EXPENSES_HEADER = [
  'date', 'where', 'item', 'category', 'currency', 'amount', 'paid_with', 'rate',
  'home_currency', 'home_amount', 'estimated', 'paid_by', 'shared_with',
];

export function expensesCsv(trip: GroupDoc, expenses: ExpenseDoc[], itemsByExpense: Record<string, ItemDoc[]>, cash: TripCash): string {
  const home = trip.currency;
  const name = (uid: string) => text(tripMemberName(trip, uid, ''));
  const rows = [...expenses]
    .sort((a, b) => expenseDay(a).localeCompare(expenseDay(b)))
    .flatMap((e) => {
      const items = itemsByExpense[e.id] ?? [];
      const currency = e.currency ?? home;
      const homeTotal = expenseHomeTotal(e, home, cash.values);
      const parts = homeTotal === null ? null : spreadInProportion(homeTotal, items.map((it) => it.amount));
      const paid = e.paidWith;
      const kitty = paid?.kind === 'wallet' && isKittyId(paid.walletId);
      const paidWith = paid?.kind === 'wallet' ? (kitty ? 'kitty' : `cash (${tripMemberName(trip, e.payerUid, '')})`) : 'card';
      let rate = '';
      if (paid?.kind === 'card') rate = String(paid.rate);
      else if (homeTotal) rate = readableWalletRate({ foreign: e.total, home: homeTotal }, currency, home);
      return items.map((it, i) => line([
        expenseDay(e),
        text(e.shopName ?? ''),
        text(it.name),
        text(it.category ?? ''),
        currency,
        plain(it.amount, currency),
        paidWith,
        rate,
        home,
        parts ? plain(parts[i], home) : '',
        isEstimated(e, home) ? 'yes' : 'no',
        kitty ? `kitty (handed over by ${tripMemberName(trip, e.payerUid, '')})` : name(e.payerUid),
        it.shared ? text((it.sharedWith ?? trip.memberUids).map((uid) => tripMemberName(trip, uid, '')).join('; ')) : 'personal',
      ]));
    });
  return [line(EXPENSES_HEADER), ...rows].join('');
}

const CASH_HEADER = ['wallet', 'date', 'what', 'person', 'currency', 'cash', 'home_currency', 'cost'];

export function cashCsv(trip: GroupDoc, cash: TripCash, expenses: ExpenseDoc[]): string {
  const home = trip.currency;
  const name = (uid: string) => text(tripMemberName(trip, uid, ''));
  const byId = new Map(expenses.map((e) => [e.id, e]));
  const rows: { date: string; cells: Cell[] }[] = [];
  for (const w of cash.wallets) {
    const { currency } = w.wallet;
    const label = w.wallet.kind === 'kitty' ? `Kitty ${currency}` : text(`${tripMemberName(trip, w.wallet.ownerUid ?? '', '')} ${currency}`);
    for (const t of w.topUps) {
      const who = w.wallet.kind === 'kitty' ? t.fromUid ?? t.byUid : w.wallet.ownerUid ?? '';
      rows.push({ date: t.date, cells: [label, t.date, w.wallet.kind === 'kitty' ? 'put in' : 'bought', name(who), currency, plain(t.foreignAmount, currency), home, plain(t.homeAmount, home)] });
    }
    for (const h of w.handovers) {
      const out = h.fromUid === w.wallet.ownerUid;
      const value = cash.handoverValues[h.id];
      const sign = out ? -1 : 1;
      rows.push({ date: h.date, cells: [
        label, h.date, out ? `handed to ${tripMemberName(trip, h.toUid, '')}` : `received from ${tripMemberName(trip, h.fromUid, '')}`, name(out ? h.fromUid : h.toUid),
        currency, plain(sign * h.foreignAmount, currency), home, value == null ? '' : plain(sign * value, home),
      ] });
    }
    for (const p of w.payments) {
      const e = byId.get(p.id) ?? p;
      const value = cash.values[p.id];
      rows.push({ date: expenseDay(e), cells: [
        label, expenseDay(e), `spent: ${e.shopName ?? ''}`, name(e.payerUid), currency,
        plain(-e.total, currency), home, value == null ? '' : plain(-value, home),
      ] });
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return [line(CASH_HEADER), ...rows.map((r) => line(r.cells))].join('');
}

/** File names from the trip's name: "Japan & Korea" → japan-korea-expenses.csv. */
export function exportFileNames(trip: GroupDoc): { expenses: string; cash: string } {
  const slug = trip.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'trip';
  return { expenses: `${slug}-expenses.csv`, cash: `${slug}-cash.csv` };
}
