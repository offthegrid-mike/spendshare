import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { memberName } from '../../lib/balance';
import { paths } from '../../lib/paths';
import { formatMinor } from '../../lib/travel/currency';
import { expenseHomeTotal, isEstimated, tripDayGroups } from '../../lib/travel/tripExpense';
import { isKittyId } from '../../lib/travel/cash';
import type { ExpenseDoc, GroupDoc, ItemDoc } from '../../types/models';

interface Props {
  trip: GroupDoc;
  expenses: ExpenseDoc[];
  itemsByExpense: Record<string, ItemDoc[]>;
  viewerUid: string;
  /** Cash payments' home values, from tripCash. */
  cashValues?: Record<string, number | null>;
  /** A closed trip: no adding. */
  readOnly?: boolean;
}

function title(expense: ExpenseDoc, items: ItemDoc[] | undefined): string {
  return expense.shopName?.trim() || items?.[0]?.name || 'Expense';
}

function ExpenseRow({ trip, expense, items, viewerUid, cashValues }: {
  trip: GroupDoc; expense: ExpenseDoc; items?: ItemDoc[]; viewerUid: string; cashValues: Record<string, number | null>;
}) {
  const home = trip.currency;
  const currency = expense.currency ?? home;
  const homeTotal = expenseHomeTotal(expense, home, cashValues);
  const isCash = expense.paidWith?.kind === 'wallet';
  const fromKitty = expense.paidWith?.kind === 'wallet' && isKittyId(expense.paidWith.walletId);
  const payer = expense.payerUid === viewerUid ? 'You' : memberName(trip, expense.payerUid);
  return (
    <li>
      <Link
        to={paths.tripExpense(trip.id, expense.id)}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-recessed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{title(expense, items)}</span>
          <span className="block text-xs text-ink-muted">{fromKitty ? 'From the kitty' : `${payer} paid`}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums text-ink">{formatMinor(expense.total, currency)}</span>
          {currency !== home && (homeTotal !== null || isCash) && (
            <span className="flex items-center justify-end gap-1.5 text-xs tabular-nums text-ink-muted">
              {isEstimated(expense, home) && (
                <span className="rounded-full bg-warning-soft px-1.5 py-px text-[10px] font-medium text-warning">Estimated</span>
              )}
              {isCash && (
                <span className="rounded-full bg-recessed px-1.5 py-px text-[10px] font-medium text-ink-muted">{fromKitty ? 'Kitty' : 'Cash'}</span>
              )}
              <span>{homeTotal !== null ? `≈ ${formatMinor(homeTotal, home)}` : 'Not valued yet'}</span>
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

/** A trip's expenses by day, each in its own currency with its home value, and the trip's total so far. */
export default function TripExpenseList({ trip, expenses, itemsByExpense, viewerUid, cashValues = {}, readOnly = false }: Props) {
  const home = trip.currency;
  const days = trip.trip ? tripDayGroups(expenses, trip.trip) : [];
  const totals = expenses.map((e) => expenseHomeTotal(e, home, cashValues));
  const spent = totals.reduce<number>((s, t) => s + (t ?? 0), 0);
  // Cash values move as cash is added, so they're approximate too.
  const estimated = expenses.some((e) => isEstimated(e, home) || e.paidWith?.kind === 'wallet');

  return (
    <section aria-labelledby="trip-expenses" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id="trip-expenses" className="text-base font-semibold text-ink">Expenses</h3>
        {!readOnly && (
          <Link to={paths.newTripExpense(trip.id)} className="btn-primary">
            <Plus size={14} aria-hidden="true" />
            Add expense
          </Link>
        )}
      </div>

      {expenses.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm font-semibold text-ink">No expenses yet</p>
          <p className="mt-1 text-[13px] text-ink-muted">Add what you spend, in any currency, and choose who shares each item.</p>
        </div>
      ) : (
        <>
          <div className="card flex items-baseline justify-between gap-3 px-4 py-3">
            <span className="text-sm text-ink-muted">Spent so far</span>
            <span className="text-base font-semibold tabular-nums text-ink">
              {`${estimated ? '≈ ' : ''}${formatMinor(spent, home)}`}
            </span>
          </div>
          {days.map((day) => (
            <div key={day.date}>
              <h4 className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">{day.label}</h4>
              <ul className="card divide-y divide-line overflow-hidden">
                {day.expenses.map((e) => (
                  <ExpenseRow key={e.id} trip={trip} expense={e} items={itemsByExpense[e.id]} viewerUid={viewerUid} cashValues={cashValues} />
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
